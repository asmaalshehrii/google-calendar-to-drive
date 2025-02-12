// Helper function to extract participant names from email addresses if display names are not available.
function extractNameFromEmail(email) {
  const namePart = email.split("@")[0];  // Extract the part before "@"
  const nameWithSpaces = namePart.replace(/[._-]/g, " ");  // Replace special characters with spaces
  return nameWithSpaces
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))  // Capitalize each word
    .join(" ");  // Recombine with spaces
}

// Main class to manage syncing Google Calendar events, creating folders, and handling form submissions.
class CalendarToDrive {
  constructor() {
    this.email = Session.getUser().getEmail();  // Get the email of the current script user
    this.props = PropertiesService.getScriptProperties();  // Store and retrieve properties
    this.key = { nextSyncToken: "nextSyncToken" };  // Key to store sync token for future event syncs
  }

  // Set up the initial sync for Google Calendar events and a time-based trigger
  initialSync() {
    const calendarId = this.email;

    // Delete existing triggers to avoid duplicate triggers
    ScriptApp.getProjectTriggers().forEach(trigger => ScriptApp.deleteTrigger(trigger));

    // Create a time-based trigger to check for new events every 1 minute
    ScriptApp.newTrigger("checkForNewEvents")
      .timeBased()
      .everyMinutes(1)
      .create();

    // Get and save the initial sync token
    const nextSyncToken = this.getInitialSyncToken(calendarId);
    Logger.log("Initial sync completed and 1-minute trigger set up. Token: " + nextSyncToken);
  }

  // Retrieve the initial sync token from Google Calendar to track updates
  getInitialSyncToken(calendarId) {
    const initialSync = Calendar.Events.list(calendarId);
    const nextSyncToken = initialSync.nextSyncToken;
    this.saveNextSyncToken(nextSyncToken);  // Store the sync token for future reference
    Logger.log("Initial sync token saved.");
    return nextSyncToken;
  }

  // Check for new calendar events and process them
  checkForNewEvents() {
    Logger.log("Checking for new events...");
    let nextSyncToken = this.getNextSyncToken();  // Retrieve the last saved sync token
    const calendarId = this.email;

    if (!nextSyncToken) {
      Logger.log("No sync token found. Performing initial sync.");
      nextSyncToken = this.getInitialSyncToken(calendarId);  // Perform initial sync if no token is found
    }

    // List events updated since the last sync
    const response = Calendar.Events.list(calendarId, {
      syncToken: nextSyncToken,
    });

    // Exit if no new events are found
    if (!response.items || response.items.length === 0) {
      Logger.log("No new events found.");
      return;
    }

    Logger.log(`Found ${response.items.length} new event(s).`);
    // Process each event and create corresponding folders
    response.items.forEach(event => {
      if (event.status !== "cancelled") {
        this.createDriveFolder(event);  // Create a folder for the event if not canceled
      }
    });

    // Save the updated sync token for future checks
    this.saveNextSyncToken(response.nextSyncToken);
    Logger.log("New events processed, and folders created.");
  }

  // Create a Google Drive folder for the calendar event and store information
  createDriveFolder(event) {
    const attendees = event.attendees;
    if (attendees && attendees.length >= 2) {
      // Get participant names from displayName or email
      const participantAName = attendees[0].displayName || extractNameFromEmail(attendees[0].email);
      const participantBName = attendees[1].displayName || extractNameFromEmail(attendees[1].email);

      // Format the folder name as "Participant A + Participant B Handoff"
      const folderName = `${participantAName} + ${participantBName} Handoff`;
      const folder = DriveApp.createFolder(folderName);  // Create the folder

      // Store folder ID and participant email information for future reference
      this.props.setProperty("lastCreatedFolderId", folder.getId());
      this.props.setProperty("participantAEmail", attendees[0].email);
      this.props.setProperty("participantBEmail", attendees[1].email);

      // Share the folder with Participant A's email
      folder.addEditor(attendees[0].email);
      Logger.log(`Folder "${folderName}" created and shared with ${participantAName}`);
    }
  }

  // Handle form submissions, generate a PDF of responses, and notify participants via email
  handleFormSubmission(e) {
    const formResponse = e.response;  // Get the form response object
    const itemResponses = formResponse.getItemResponses();  // Get individual question responses
    let formResponseText = "";

    // Format each question response into readable text
    itemResponses.forEach(response => {
      formResponseText += `${response.getItem().getTitle()}: ${response.getResponse()}\n`;
    });

    // Retrieve the ID of the folder created for the calendar event
    const folderId = this.props.getProperty("lastCreatedFolderId");
    if (!folderId) {
      Logger.log("No folder found.");
      return;
    }

    // Generate a PDF with the form responses and save it in the folder
    const pdfFile = this.generatePdfFile(formResponseText, folderId);
    const participantAEmail = this.props.getProperty("participantAEmail");
    const participantBEmail = this.props.getProperty("participantBEmail");

    // Ensure both participant emails are available
    if (!participantAEmail || !participantBEmail) {
      Logger.log("Missing participant emails for notification.");
      return;
    }

    // Send email notifications with a link to the PDF
    this.sendEmailNotifications(participantAEmail, participantBEmail, pdfFile.getName());
  }

  // Generate a PDF with the provided text and save it to the specified folder
  generatePdfFile(responseText, folderId) {
    const folder = DriveApp.getFolderById(folderId);  // Get the folder by its ID
    const blob = Utilities.newBlob(`Form Responses:\n\n${responseText}`, "application/pdf", "Form_Responses.pdf");
    return folder.createFile(blob);  // Create and save the PDF file
  }

  // Send email notifications to both participants
  sendEmailNotifications(participantAEmail, participantBEmail, pdfFileName) {
    const subject = "Form Submission Processed";
    const message = `Form responses have been saved as a PDF (${pdfFileName}) in the shared Drive folder.`;
    GmailApp.sendEmail(participantAEmail, subject, message);  // Notify Participant A
    GmailApp.sendEmail(participantBEmail, subject, message);  // Notify Participant B
  }

  // Save the next sync token to keep track of future updates
  saveNextSyncToken(token) {
    if (!token) return;
    this.props.setProperty(this.key.nextSyncToken, token);
    Logger.log("Next sync token saved.");
  }

  // Retrieve the last saved sync token
  getNextSyncToken() {
    const token = this.props.getProperty(this.key.nextSyncToken);
    if (!token) Logger.log("No sync token found.");
    return token;
  }
}

// // Manually Create a trigger to monitor form submissions
function createFormTrigger() {
  const formId = "18-oOohPlRcwzQsBSNRqHMjpshSv_zk1lwKgq5SM2LBg";  // Replace with your form ID
  const form = FormApp.openById(formId);

  // Create a trigger to run on form submission
  ScriptApp.newTrigger("handleFormSubmission")
    .forForm(form)
    .onFormSubmit()
    .create();

  Logger.log("Form submission trigger successfully created.");
}

// Manually triggered functions for initial setup and testing
function initialSync() {
  const calendarInstance = new CalendarToDrive();
  calendarInstance.initialSync();
}

function checkForNewEvents() {
  const calendarInstance = new CalendarToDrive();
  calendarInstance.checkForNewEvents();
}

function handleFormSubmission(e) {
  const calendarInstance = new CalendarToDrive();
  calendarInstance.handleFormSubmission(e);
}

function testFormAccess() {
  const formId = "18-oOohPlRcwzQsBSNRqHMjpshSv_zk1lwKgq5SM2LBg";  // Correct form ID
  try {
    const form = FormApp.openById(formId);
    Logger.log("Successfully accessed form: " + form.getTitle());
  } catch (e) {
    Logger.log("Error accessing form: " + e.message);
  }
}

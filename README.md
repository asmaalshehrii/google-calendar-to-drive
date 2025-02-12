# google-calendar-to-drive
# Calendar to Drive Sync

This Google Apps Script automates the synchronization of Google Calendar events with Google Drive, creating shared folders for event participants and handling form submissions.

## Features
- Syncs Google Calendar events and creates corresponding Google Drive folders.
- Extracts participant names from emails if display names are unavailable.
- Creates and manages Google Apps Script triggers for event monitoring.
- Handles form submissions, generates PDFs, and notifies event participants via email.

## How It Works
1. **Initial Sync:**  
   - Fetches calendar events and sets up a sync token.
   - Schedules a time-based trigger to check for new events every minute.

2. **Event Processing:**  
   - Detects new or updated calendar events.
   - Creates a Drive folder named after event participants.
   - Stores folder details for further processing.

3. **Form Handling:**  
   - Captures form submissions.
   - Generates a PDF with form responses and saves it in the event folder.
   - Sends email notifications to event participants.

## Setup Instructions
1. Open Google Apps Script (https://script.google.com).
2. Create a new script project.
3. Copy and paste the provided script.
4. Replace the form ID (`formId`) with your Google Form ID.
5. Run `initialSync()` to start calendar event tracking.
6. Run `createFormTrigger()` to enable form submission handling.

## Manual Functions
- `initialSync()`: Starts calendar sync and triggers.
- `checkForNewEvents()`: Manually checks for new events.
- `handleFormSubmission(e)`: Processes form responses.
- `testFormAccess()`: Checks form connectivity.

## Requirements
- Google Calendar API
- Google Drive API
- Google Forms API (if using form submission handling)
- Gmail API (for email notifications)

## License
This project is licensed under the MIT License.

## Author
Created by **Asma Alshehri**.

# Image Upload Error Handling & Quality Constraints

Description

 

User Role: Student

Precondition: User is in the chat interface and attempting to upload a local image file.

Steps to Reproduce:

Select an image for upload (specifically one with lower resolution or high compression).

Attempt to send the image in the chat.

Note the "Generic Error" message and the failed load.

Attempt to upload the exact same image but at a higher resolution/quality.

Observe that the high-quality version proceeds successfully.

Expected Result: The system should either successfully process the image regardless of quality (within reasonable limits) OR provide a clear, actionable error message (e.g., "Image resolution too low, please upload a clearer photo").

Actual Result: The upload fails intermittently with a vague error, leaving the student confused about why the image was rejected.
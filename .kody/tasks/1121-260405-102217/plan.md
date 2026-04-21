{
  "task_type": "bugfix",
  "title": "Fix image upload error handling with quality constraints",
  "description": "When users upload low-resolution or highly compressed images in the chat, they receive a generic error message instead of an actionable error. The issue is that Vercel Blob may reject certain images, but the error handling doesn't properly surface the specific error to the user. Need to improve error messages and/or add client-side validation for image dimensions before upload.",
  "scope": [
    "src/ui/web/chat/hooks/useDirectChatAssetUpload.ts",
    "src/server/chat-assets/constants.ts"
  ],
  "risk_level": "medium",
  "questions": []
}

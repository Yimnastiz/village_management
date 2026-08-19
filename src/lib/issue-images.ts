export type IssueImageInput = {
  url: string;
  fileKey?: string;
  uploadToken?: string;
  fileName?: string;
  sizeBytes?: number;
};

export const issueImageUploadUrl = (fileKey: string) =>
  `/api/places/images?key=${encodeURIComponent(fileKey)}`;

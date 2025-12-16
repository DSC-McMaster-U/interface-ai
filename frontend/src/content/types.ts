/**
 * TypeScript interfaces for message passing between content and background scripts
 */

export interface ApiRequestMessage {
  type: "API_REQUEST";
  payload: {
    endpoint: string;
    method: string;
    body?: unknown;
  };
}

export interface ApiResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface UserSettings {
  name: string;
  gender: string;
  address: string;
  email: string;
  phone: string;
  interests: string[];
}

export interface GetUserSettingsMessage {
  type: "GET_USER_SETTINGS";
}

export interface UpdateUserSettingsMessage {
  type: "UPDATE_USER_SETTINGS";
  payload: UserSettings;
}

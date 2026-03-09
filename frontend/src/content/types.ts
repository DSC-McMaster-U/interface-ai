/**
 * TypeScript interfaces for message passing between content and background scripts
 */

import type { ActionType } from "./actions";

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

/** Expected response shape from the backend chat/relay endpoint */
export interface ChatApiResponse {
  message?: string;
  echo?: string;
  actions?: ActionType[];
}

/** Message sent from background to content script to execute an action */
export interface ExecuteActionMessage {
  type: "EXECUTE_ACTION";
  payload: ActionType;
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

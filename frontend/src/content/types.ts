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

/** Authenticated Google user info */
export interface AuthUser {
  userId: string;
  email: string;
  name?: string;
  picture?: string;
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

export interface GoogleSignInMessage {
  type: "GOOGLE_SIGN_IN";
}

export interface GoogleSignOutMessage {
  type: "GOOGLE_SIGN_OUT";
}

export interface GetAuthStateMessage {
  type: "GET_AUTH_STATE";
}

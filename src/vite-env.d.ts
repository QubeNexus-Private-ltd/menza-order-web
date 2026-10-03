/// <reference types="vite/client" />

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.jpg' {
  const content: string;
  export default content;
}

declare module '*.jpeg' {
  const content: string;
  export default content;
}

declare module '*.gif' {
  const content: string;
  export default content;
}

declare module 'react-native' {
  import * as React from 'react';
  export type ViewStyle = any;
  export type TextStyle = any;
  export type ImageStyle = any;
  export type StyleProp<T> = any;
  export const View: any;
  export const Text: any;
  export const TouchableOpacity: any;
  export const TextInput: any;
  export const ScrollView: any;
  export const Modal: any;
  export const ActivityIndicator: any;
  export const Image: any;
  export const FlatList: any;
  export const StyleSheet: {
    create: <T extends Record<string, any>>(styles: T) => T;
    [key: string]: any;
  };
  export const Dimensions: any;
  export const Platform: any;
  export const Pressable: any;
  export const SafeAreaView: any;
  export const Alert: any;
  export const Animated: any;
  export const Easing: any;
  export const StatusBar: any;
  export const KeyboardAvoidingView: any;
  export const TouchableWithoutFeedback: any;
  export const RefreshControl: any;
  const anyExport: any;
  export default anyExport;
}

declare module 'react-native-web' {
  export * from 'react-native';
}

interface Window {
  Cashfree?: any;
  [key: string]: any;
}

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SIGNALR_HUB_URL?: string;
  readonly VITE_AZURE_BLOB_BASE_URL?: string;
  readonly VITE_ENCRYPTION_SALT?: string;
  readonly VITE_CASHFREE_MODE?: string;
  readonly VITE_API_TIMEOUT_MS?: string;
  readonly VITE_APP_URL?: string;
  readonly VITE_DEFAULT_VEG_IMAGE?: string;
  readonly VITE_DEFAULT_NON_VEG_IMAGE?: string;
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

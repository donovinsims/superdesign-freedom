declare module '*.css' {
    const content: string;
    export default content;
  }
  
  declare module '*.scss' {
    const content: string;
    export default content;
  }
  
  // VS Code webview API
  declare function acquireVsCodeApi(): {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
  };

// Add csp property to React's iframe attributes
declare namespace React {
  interface IframeHTMLAttributes<T> {
    csp?: string;
  }
}
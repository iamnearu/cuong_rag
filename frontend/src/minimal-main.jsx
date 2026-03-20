import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import App from "@/App.jsx";
import SimpleHome from "@/pages/SimpleHome";
import WorkspaceChat from "@/pages/WorkspaceChat";
import "@/index.css";

const isDev = process.env.NODE_ENV !== "production";
const REACTWRAP = isDev ? React.Fragment : React.StrictMode;

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        path: "/",
        element: <SimpleHome />,
      },
      {
        path: "/workspace/:slug",
        element: <WorkspaceChat />,
      },
      {
        path: "/workspace/:slug/t/:threadSlug",
        element: <WorkspaceChat />,
      },
      {
        path: "*",
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <REACTWRAP>
    <RouterProvider router={router} />
  </REACTWRAP>
);

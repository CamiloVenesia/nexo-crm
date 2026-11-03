
import React from 'react';
import ReactDOM from 'react-dom/client';

import {
  AppErrorBoundary,
  ConnectionNotice,
} from './components/AppErrorBoundary';

import { DemoPortal } from './components/DemoPortal';

import './navigation-polish.css';
import './ux-polish.css';

ReactDOM.createRoot(
  document.getElementById('root')!,
).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ConnectionNotice />
      <DemoPortal />
    </AppErrorBoundary>
  </React.StrictMode>,
);

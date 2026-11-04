import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider, CartProvider, CityProvider } from './context.jsx';
import './index.css';
createRoot(document.getElementById('root')).render(
  <BrowserRouter><AuthProvider><CityProvider><CartProvider><App /></CartProvider></CityProvider></AuthProvider></BrowserRouter>
);

import React from 'react'
import './App.css'
import { Checkout } from "./components/Checkout"

// Entry standalone: serve solo a sviluppare il remote da solo (`pnpm dev`).
// Lo shell non passa da qui, importa direttamente "checkout/Checkout".
function App() {
	return <Checkout />
}

export default App

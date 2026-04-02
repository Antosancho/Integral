import { useState } from "react"
import "./App.css"
import Header from "./Pages/Header"
import type { Cont } from "./renderTypes"
import Stock from "./Pages/Stock"

function App() {
  const [content, setContent] = useState<Cont>(null)

  return (
    <>
      <Header content={content} setContent={setContent} />
      {content === "sells" && <div>Sells</div>}
      {content === "stock" && <Stock />}
      {content === null && <div>Home</div>}
    </>
  )
}

export default App
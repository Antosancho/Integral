import { useState } from "react"
import "./App.css"
import Header from "./Pages/Header"
import type { Cont } from "./renderTypes"
import Stock from "./Pages/Stock"
import Sells from "./Pages/Sells/Sells"

function App() {
  const [content, setContent] = useState<Cont>(null)

  return (
    <>
      <Header content={content} setContent={setContent} />
      <main className="app-content">
        {content === "sells" && <Sells />}
        {content === "stock" && <Stock />}
        {content === null && <div>Home</div>}
      </main>
    </>
  )
}

export default App
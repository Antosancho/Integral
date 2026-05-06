import { useState } from "react"
import "./App.css"
import Header from "./Pages/Header"
import type { Cont } from "./renderTypes"
import Stock from "./Pages/Stock"
import Sells from "./Pages/Sells/Sells"
import SalesHistory from "./Pages/SalesHistory/SalesHistory"
import Stats from "./Pages/Stats/Stats"

function App() {
  const [content, setContent] = useState<Cont>('stock')

  return (
    <>
      <Header content={content} setContent={setContent} />
        <main className="app-content">
          {content === "sells" && <Sells />}
          {content === "stock" && <Stock />}
          {content === "history" && <SalesHistory />}
          {content === "stats" && <Stats />}
        </main>
    </>
  )
}

export default App
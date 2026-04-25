import type { Dispatch, SetStateAction } from "react"
import type { Cont } from "../renderTypes"

interface HeaderProps {
  content: Cont
  setContent: Dispatch<SetStateAction<Cont>>
}

export default function Header({ content, setContent }: HeaderProps) {
  const handleClick = (next: Cont) => {
    setContent(next)
  }

  return (
    <header className="Header">
       <ul className="Header__nav">
         <button
           className="header-button"
           onClick={() => handleClick(null)}
           aria-pressed={content === null}
         >
           Home
         </button>
         <button
           className="header-button"
           onClick={() => handleClick("sells")}
           aria-pressed={content === "sells"}
         >
           Sells
         </button>
         <button
           className="header-button"
           onClick={() => handleClick("history")}
           aria-pressed={content === "history"}
         >
           Historial
         </button>
         <button
           className="header-button"
           onClick={() => handleClick("stock")}
           aria-pressed={content === "stock"}
         >
           Stock
         </button>
       </ul>
    </header>
  )
}

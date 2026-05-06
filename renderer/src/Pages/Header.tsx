import type { Dispatch, SetStateAction } from "react"
import type { Cont } from "../renderTypes"
import ExpiryAlertWidget from '../Components/ExpiryAlert/ExpiryAlertWidget'

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
         <button
           className={content === 'stats' ? 'header__nav-btn--active' : 'header-button'}
           onClick={() => handleClick("stats")}
           aria-pressed={content === "stats"}
         >
           Estadísticas
         </button>
       </ul>
       {/* Widget de alertas de vencimiento: se posiciona a la derecha gracias a justify-content: space-between del .Header */}
       <ExpiryAlertWidget />
    </header>
  )
}

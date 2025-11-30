import React from "react";
import ReactDOM from "react-dom/client";

const container = document.createElement("div");
container.id = "interfaceai-root";
document.body.appendChild(container);

// Styles injected via JS
const style = document.createElement("style");
style.textContent = `
  #interfaceai-floating-icon {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 46px;
    height: 46px;
    background: #1f1f1f;
    color: white;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 999999;
    font-size: 22px;
    box-shadow: 0 3px 8px rgba(0,0,0,0.25);
  }

  #interfaceai-chatbar {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0;
    background: white;
    border-top: 2px solid #d0d0d0;
    z-index: 999998;
    overflow: hidden;
    transition: height 0.25s ease-in-out;
    box-shadow: 0 -4px 12px rgba(0,0,0,0.1);
  }

  #interfaceai-chatbar.open {
    height: 320px;
  }
`;

document.appendChild(style)

function FloatingUI() {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <div id="interfaceai-floating-icon" onClick={() => setOpen(!open)}>
        💬
      </div>

      <div id="interfaceai-chatbar" className={open ? "open" : ""}>
        <div style={{ padding: "16px", fontFamily: "Inter, sans-serif" }}>
          <h2 style={{ fontWeight: 600, marginBottom: 12 }}>
            InterfaceAI Chat
          </h2>
          <input
            placeholder="Ask InterfaceAI..."
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: 6,
              border: "1px solid #ccc",
            }}
          />
        </div>
      </div>
    </>
  )
};

ReactDOM.createRoot(container).render(<FloatingUI />);
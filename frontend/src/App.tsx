import { useState } from "react";
import SettingsIcon from "./assets/settings.svg";
import CloseIcon from "./assets/close.svg";
import Settings from "./Settings";

function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const sendToBackend = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setResponse("Sending...");

    try {
      const res = await fetch("http://localhost:5000/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      const data = await res.json();
      setResponse(`Response: ${data.echo}`);
    } catch (e) {
      setResponse(`Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  };

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  return (
    <>
      <div className="flex flex-col w-[279px] h-[437px] gap-2">
        <div className="flex flex-row relative bg-white items-center text-black px-2 pt-2 mb-1 justify-between">
          {/* add logo jpg as well */}
          <h1 className="text-lg">InterfaceAI</h1>
          <div className="flex flex-row gap-2">
            <button onClick={() => setShowSettings(true)}>
              <img src={SettingsIcon} className="w-5 h-5 cursor-pointer" />
            </button>
            <button>
              <img src={CloseIcon} className="w-5 h-5 cursor-pointer" />
            </button>
          </div>
        </div>
        {/* need to add active state and adjust colors accordingly, also add animations on click */}
        <div className="flex flex-row relative justify-between items-center gap-1 px-4 font-bold">
          <div className="flex justify-center items-center bg-blue-400 p-2 w-32 rounded-4xl cursor-pointer">
            <p className="text-md ">Logs</p>
          </div>
          <div className="flex justify-center items-center bg-black p-2 w-32 rounded-lg cursor-pointer">
            <p className="text-md ">Profile</p>
          </div>
        </div>
        <div className="flex justify-center items-center">
          <div className="flex justify-center relative items-center w-[86%] py-3 rounded-md bg-blue-400 mt-2">
            {/* get website name and display here */}
            <div>site.com</div>
          </div>
        </div>

        {/* Send to Backend Section */}
        <div className="flex flex-col items-center px-4 py-2 gap-2">
          <div className="w-full flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendToBackend()}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <button
              onClick={sendToBackend}
              disabled={loading || !message.trim()}
              className="px-4 py-2 bg-blue-500 text-black rounded-md text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
          {response && (
            <div className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-xs text-gray-800">
              {response}
            </div>
          )}
        </div>

        {/* should have more functionality here, figure out what it needs*/}
        <div className="flex justify-center items-center px-4 py-2">
          <div className="relative flex flex-col overflow-y-scroll rounded-lg overflow-x-auto p-2 gap-1 border-2 border-black text-black h-32 whitespace-nowrap no-scrollbar">
            <ul className="space-y-1 text-sm whitespace-nowrap">
              {/* turn this into custom logs w/ highlights and color coded */}
              <li>
                [2025-11-06 13:42:17] [EXTENSION] User command received: "book
                flight to Toronto"
              </li>
              <li>
                [2025-11-06 13:42:18] [LANGGRAPH] Intent detected:
                travel.booking
              </li>
              <li>
                [2025-11-06 13:42:18] [LANGGRAPH] State transition →
                SEARCH_FLIGHTS
              </li>
              <li>
                [2025-11-06 13:42:19] [VISION_AI] Screenshot captured
                (tab_3.png)
              </li>
              <li>
                [2025-11-06 13:42:19] [VISION_AI] Detected 4 buttons, 2 input
                fields
              </li>
              <li>
                [2025-11-06 13:42:20] [ACTION_EXECUTOR] Navigating to
                https://www.google.com/travel/flights
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;

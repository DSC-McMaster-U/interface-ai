import { useState, useEffect } from "react";

import SettingsIcon from "./assets/settings.svg";
import CloseIcon from "./assets/close.svg";

function App() {
  const [activeTab, setActiveTab] = useState<"logs" | "profile">("logs");
  const [currentSite, setCurrentSite] = useState<string>("");

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true}, (tabs) => {
      if (tabs.length > 0 && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          setCurrentSite(url.hostname.replace("www.", ""));
        } catch {
          setCurrentSite("unknown");
        }
      }
    });
  }, []);

  const handleClose = () => {
    window.close();
  };
  const handleSettings = () => {
    chrome.runtime.openOptionsPage();
  };

  const baseTabClasses = "flex justify-center items-center p-2 w-32 rounded-lg cursor-pointer transition-all duration-150"
  const activeClasses = "bg-blue-400 text-white rounded-xl scale-[1.03]"
  const inactiveClasses = "bg-black text-white opacity-80 hover:opacity-100"
  return (
    <>
      <div className="flex flex-col w-[279px] h-[437px] gap-2">
        <div className="flex flex-row relative bg-white items-center text-black px-2 pt-2 mb-1 justify-between">
          {/* add logo jpg as well */}
          <h1 className="text-lg">InterfaceAI</h1>
          <div className="flex flex-row gap-2">
            <button onClick={handleSettings}>
              <img src={SettingsIcon} className="w-5 h-5 cursor-pointer" />
            </button>
            <button onClick={handleClose}>
              <img src={CloseIcon} className="w-5 h-5 cursor-pointer" />
            </button>
          </div>
        </div>
        <div className="flex flex-row relative justify-between items-center gap-1 px-4 font-bold">
          <div onClick={() => setActiveTab("logs")} className={`${baseTabClasses} ${activeTab === "logs" ? activeClasses : inactiveClasses}`}>
            <p className="text-md ">Logs</p>
          </div>
          <div onClick={() => setActiveTab("profile")} className={`${baseTabClasses} ${activeTab === "profile" ? activeClasses : inactiveClasses}`}>
            <p className="text-md ">Profile</p>
          </div>
        </div>
        <div className="flex justify-center items-center">
          <div className="flex justify-center relative items-center w-[86%] py-3 rounded-md bg-blue-400 mt-2">
            <div className="text-lg font-600">{currentSite || "loading..."}</div>
          </div>
        </div>
        {/* should have more functionality here, figure out what it needs*/}
        {/* LOG CONTENT (placeholder) */}
        {activeTab === "logs" && (
          <div className="flex justify-center items-center px-4 py-4 mt-10">
            <div className="relative flex flex-col overflow-y-scroll rounded-lg overflow-x-auto p-2 gap-1 border-2 border-black text-black h-50 whitespace-nowrap no-scrollbar">
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
        )}
        {/* PROFILE CONTENT (placeholder) */}
        {activeTab === "profile" && (
          <div className="flex justify-center mt-10 text-black text-sm">
            <p>Profile settings coming soon...</p>
          </div>
        )}
      </div>
    </>
  );
}

export default App;

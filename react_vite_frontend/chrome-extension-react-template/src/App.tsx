import SettingsIcon from './assets/settings.svg';
import CloseIcon from './assets/close.svg';

function App() {
  return (
    <>
    <div className='flex flex-col w-[279px] h-[437px] gap-2'>
      <div className="flex flex-row relative bg-white items-center text-black px-2 pt-2 mb-1 justify-between">
        {/* add logo jpg as well */}
        <h1 className='text-lg'>InterfaceAI</h1>
        <div className="flex flex-row gap-2">
          <button><img src={SettingsIcon} className="w-5 h-5 cursor-pointer" /></button>
          <button><img src={CloseIcon} className="w-5 h-5 cursor-pointer" /></button>
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
      <div className='flex justify-center items-center'>
        <div className="flex justify-center relative items-center w-[86%] py-3 rounded-md bg-blue-400 mt-2">
          {/* get website name and display here */}
          <div>site.com</div>
        </div>
      </div>
      {/* should have more functionality here, figure out what it needs*/}
      <div className='flex justify-center items-center px-4 py-4 mt-10'>
        <div className="relative flex flex-col overflow-y-scroll rounded-lg overflow-x-auto p-2 gap-1 border-2 border-black text-black h-50 whitespace-nowrap no-scrollbar">
          <ul className="space-y-1 text-sm whitespace-nowrap">
            {/* turn this into custom logs w/ highlights and color coded */}
            <li>[2025-11-06 13:42:17] [EXTENSION] User command received: "book flight to Toronto"</li>
            <li>[2025-11-06 13:42:18] [LANGGRAPH] Intent detected: travel.booking</li>
            <li>[2025-11-06 13:42:18] [LANGGRAPH] State transition → SEARCH_FLIGHTS</li>
            <li>[2025-11-06 13:42:19] [VISION_AI] Screenshot captured (tab_3.png)</li>
            <li>[2025-11-06 13:42:19] [VISION_AI] Detected 4 buttons, 2 input fields</li>
            <li>[2025-11-06 13:42:20] [ACTION_EXECUTOR] Navigating to https://www.google.com/travel/flights</li>
          </ul>
        </div>
      </div>
    </div>
    </>
  )
}

export default App

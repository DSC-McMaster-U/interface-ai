import { useState } from "react";
import CloseIcon from "./assets/close.svg";

interface SettingsProps {
  onClose: () => void;
}

function Settings({ onClose }: SettingsProps) {
  const [userInfo, setUserInfo] = useState({
    name: "John Doe",
    gender: "Male",
    address: "123 Alphabet st.",
    email: "john.doe@email.com",
    phone: "123-456-7890",
    home: "123 Alphabet st.",
  });

  const [interests, setInterests] = useState([
    "Programming",
    "Travel",
    "Cats",
    "Baked Goods",
    "Photography",
    "Ice Cream",
  ]);

  const removeInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
  };

  const addInterest = () => {
    const newInterest = prompt("Enter new interest:");
    if (newInterest && newInterest.trim()) {
      setInterests([...interests, newInterest.trim()]);
    }
  };

  const editField = (field: keyof typeof userInfo) => {
    const newValue = prompt(`Enter new ${field}:`, userInfo[field]);
    if (newValue !== null && newValue.trim()) {
      setUserInfo({ ...userInfo, [field]: newValue.trim() });
    }
  };

  return (
    <div className="flex flex-col w-[279px] min-h-[200px] max-h-[600px] bg-white relative">
      {/* Close Button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 text-gray-600 hover:text-gray-800 z-10"
      >
        <img src={CloseIcon} className="w-5 h-5 cursor-pointer" />
      </button>

      {/* Settings Content - Side by Side */}
      <div className="flex flex-row gap-2 p-3 pt-10">
        {/* Settings Menu */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-sm flex-1">
          <div className="text-gray-800 text-[10px] space-y-2">
            <div className="underline cursor-pointer hover:text-blue-600 font-medium">
              You
            </div>
            <div className="cursor-pointer hover:text-blue-600">Autofill</div>
            <div className="cursor-pointer hover:text-blue-600">Privacy</div>
            <div className="cursor-pointer hover:text-blue-600">Appearance</div>
            <div className="cursor-pointer hover:text-blue-600">System</div>
            <div className="cursor-pointer hover:text-blue-600">Languages</div>
            <div className="cursor-pointer hover:text-blue-600">Reset</div>
            <div className="cursor-pointer hover:text-blue-600">Log Out</div>
          </div>
        </div>

        {/* User Profile Section */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 shadow-sm flex-1">
          <h2 className="text-gray-800 text-[11px] font-semibold mb-1.5">
            Hi, {userInfo.name.split(" ")[0]}
          </h2>

          <div className="text-gray-700 text-[9px] space-y-0.5 mb-1.5">
            <p
              className="cursor-pointer hover:text-blue-600 truncate"
              onClick={() => editField("name")}
              title={`Name: ${userInfo.name}`}
            >
              Name: {userInfo.name}
            </p>
            <p
              className="cursor-pointer hover:text-blue-600 truncate"
              onClick={() => editField("gender")}
              title={`Gender: ${userInfo.gender}`}
            >
              Gender: {userInfo.gender}
            </p>
            <p
              className="cursor-pointer hover:text-blue-600 truncate"
              onClick={() => editField("address")}
              title={`Address: ${userInfo.address}`}
            >
              Address: {userInfo.address}
            </p>
          </div>

          <div className="text-gray-700 text-[9px] space-y-0.5 mb-1.5">
            <p
              className="cursor-pointer hover:text-blue-600 truncate"
              onClick={() => editField("email")}
              title={`Email: ${userInfo.email}`}
            >
              Email: {userInfo.email}
            </p>
            <p
              className="cursor-pointer hover:text-blue-600 truncate"
              onClick={() => editField("phone")}
              title={`Phone: ${userInfo.phone}`}
            >
              Phone: {userInfo.phone}
            </p>
            <p
              className="cursor-pointer hover:text-blue-600 truncate"
              onClick={() => editField("home")}
              title={`Home: ${userInfo.home}`}
            >
              Home: {userInfo.home}
            </p>
          </div>

          <div className="text-gray-700 text-[9px] mb-1 font-medium">
            Interests:
          </div>

          <div className="flex flex-wrap gap-1">
            {interests.map((interest, index) => (
              <div
                key={index}
                className="bg-blue-100 border border-blue-200 rounded-full px-1.5 py-0.5 flex items-center gap-0.5"
              >
                <span className="text-blue-800 text-[8px]">{interest}</span>
                <button
                  onClick={() => removeInterest(index)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <svg
                    width="7"
                    height="7"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
            ))}
            <button
              onClick={addInterest}
              className="bg-blue-100 border border-blue-200 rounded-full w-4 h-4 flex items-center justify-center hover:bg-blue-200"
            >
              <svg width="8" height="8" viewBox="0 0 24 24" fill="#1e40af">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Settings;

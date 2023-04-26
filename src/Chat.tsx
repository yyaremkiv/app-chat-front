import React from "react";
import { useContext, useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { UserContext } from "./UserContext";
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./Contact";
import UserServices from "./service/UserServices";
import { IMessage } from "./service/UserServices";

interface IOfflineUsersType {
  _id: string;
  username: string;
}

interface IPeople {
  userId: string;
  username: string;
}

export default function Chat() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [onlinePeople, setOnlinePeople] = useState({});
  const [offlinePeople, setOfflinePeople] = useState<Record<string, any>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newMessageText, setNewMessageText] = useState<string>("");
  const [messages, setMessages] = useState<IMessage[] | []>([]);
  const { username, id, setId, setUsername } = useContext(UserContext);
  const divUnderMessages = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    connectToWs();
    return cleanup;
  }, [selectedUserId]);

  useEffect(() => {
    const div = divUnderMessages.current;
    if (div) {
      // div.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages]);

  useEffect(() => {
    const fetchPeople = async () => {
      const { data } = await UserServices.getPeople();
      const offlineUsersArray = data
        .filter((user) => user._id !== id)
        .filter((user) => !Object.keys(onlinePeople).includes(user._id));

      const offlineUsers: { [key: string]: IOfflineUsersType } = {};
      offlineUsersArray.forEach((user) => {
        offlineUsers[user._id] = user;
      });
      setOfflinePeople({ ...offlineUsers });
    };

    fetchPeople();

    // axios.get("/people").then((res) => {
    //   const offlinePeopleArr = res.data
    //     .filter((p) => p._id !== id)
    //     .filter((p) => !Object.keys(onlinePeople).includes(p._id));
    //   const offlinePeople = {};
    //   offlinePeopleArr.forEach((p) => {
    //     offlinePeople[p._id] = p;
    //   });
    //   setOfflinePeople(offlinePeople);
    // });
  }, [onlinePeople]);

  useEffect(() => {
    const fetchUserMessages = async () => {
      if (selectedUserId) {
        try {
          const { data } = await UserServices.getMessages(selectedUserId);
          setMessages(data);
        } catch (err) {
          console.log(err);
        }
      }
    };

    fetchUserMessages();
  }, [selectedUserId]);

  function connectToWs() {
    try {
      const newWs = new WebSocket(process.env.REACT_APP_WEB_SOCKET as string);
      newWs.addEventListener("message", handleMessage);
      newWs.addEventListener("close", handleDisconnect);
      newWs.addEventListener("error", (event: Event) =>
        handleError(event, newWs)
      );
      setWs(newWs);
    } catch (err: unknown) {
      console.error("Error when establishing a WebSocket connection:", err);
    }
  }

  function handleError(event: Event, newWs: WebSocket) {
    console.error("WebSocket error:", event);
    console.error("WebSocket error. ReadyState:", newWs.readyState);
  }

  function cleanup() {
    if (ws) {
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("close", handleDisconnect);
      ws.close();
    }
  }

  function handleDisconnect() {
    console.log(
      "The connection is broken. Attempting to reconnect after 1 second."
    );
    setTimeout(() => connectToWs(), 1000);
  }

  function handleMessage(e: MessageEvent) {
    const messages = JSON.parse(e.data);

    if ("online" in messages) showOnlinePeople(messages.online);

    if ("text" in messages && messages.sender === selectedUserId) {
      setMessages((prev) => [...prev, { ...messages }]);
    }
  }

  function showOnlinePeople(peopleArray: IPeople[]): void {
    const people: Record<string, string> = {};

    peopleArray.forEach(({ userId, username }) => {
      people[userId] = username;
    });
    setOnlinePeople(people);
  }

  function logout() {
    axios.post("/logout").then(() => {
      setWs(null);
      setId(null);
      setUsername(null);
    });
  }

  function sendMessage(
    e: React.FormEvent<HTMLFormElement> | null,
    file?: { name: string; data: string }
  ) {
    if (e) e.preventDefault();
    ws?.send(
      JSON.stringify({
        recipient: selectedUserId,
        text: newMessageText,
        file,
      })
    );
    if (file) {
      axios.get("/messages/" + selectedUserId).then((res) => {
        setMessages(res.data);
      });
    } else {
      setNewMessageText("");
      console.log("setMessae", messages);
      setMessages((prev) => [
        ...prev,
        {
          _id: Date.now().toString(),
          text: newMessageText,
          sender: id,
          recipient: selectedUserId,
        },
      ]);
    }
  }

  function sendFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      const reader = new FileReader();
      reader.readAsDataURL(files[0]);
      reader.onload = () => {
        sendMessage(null, {
          name: files[0].name,
          data: String(reader.result),
        });
      };
    }
  }

  const onlinePeopleExclOurUser = { ...onlinePeople } as { [key: string]: any };
  if (id) {
    delete onlinePeopleExclOurUser[id];
  }

  const messagesWithoutDupes = uniqBy(messages, "_id");

  return (
    <div className="flex h-screen">
      <div className="bg-white w-1/3 flex flex-col">
        <div className="flex-grow">
          <Logo />
          {Object.keys(onlinePeopleExclOurUser).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={true}
              username={onlinePeopleExclOurUser[userId]}
              onClick={() => {
                setSelectedUserId(userId);
                console.log({ userId });
              }}
              selected={userId === selectedUserId}
            />
          ))}
          {Object.keys(offlinePeople).map((userId) => (
            <Contact
              key={userId}
              id={userId}
              online={false}
              username={offlinePeople[userId]?.username}
              onClick={() => setSelectedUserId(userId)}
              selected={userId === selectedUserId}
            />
          ))}
        </div>
        <div className="p-2 text-center flex items-center justify-center">
          <span className="mr-2 text-sm text-gray-600 flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
            {username}
          </span>
          <button
            onClick={logout}
            className="text-sm bg-blue-100 py-1 px-2 text-gray-500 border rounded-sm"
          >
            logout
          </button>
        </div>
      </div>
      <div className="flex flex-col bg-blue-50 w-2/3 p-2">
        <div className="flex-grow">
          {!selectedUserId && (
            <div className="flex h-full flex-grow items-center justify-center">
              <div className="text-gray-300">
                &larr; Select a person from the sidebar
              </div>
            </div>
          )}
          {!!selectedUserId && (
            <div className="relative h-full">
              <div className="overflow-y-scroll absolute top-0 left-0 right-0 bottom-2">
                {messagesWithoutDupes.map((message) => (
                  <div
                    key={message._id}
                    className={
                      message.sender === id ? "text-right" : "text-left"
                    }
                  >
                    <div
                      className={
                        "text-left inline-block p-2 my-2 rounded-md text-sm " +
                        (message.sender === id
                          ? "bg-blue-500 text-white"
                          : "bg-white text-gray-500")
                      }
                    >
                      {message.text}
                      {message.file && (
                        <div className="">
                          <a
                            target="_blank"
                            className="flex items-center gap-1 border-b"
                            href={
                              axios.defaults.baseURL +
                              "/uploads/" +
                              message.file
                            }
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              className="w-4 h-4"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {message.file}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={divUnderMessages}></div>
              </div>
            </div>
          )}
        </div>
        {!!selectedUserId && (
          <form className="flex gap-2" onSubmit={sendMessage}>
            <input
              type="text"
              value={newMessageText}
              onChange={(ev) => setNewMessageText(ev.target.value)}
              placeholder="Type your message here"
              className="bg-white flex-grow border rounded-sm p-2"
            />
            <label className="bg-blue-200 p-2 text-gray-600 cursor-pointer rounded-sm border border-blue-200">
              <input type="file" className="hidden" onChange={sendFile} />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-6 h-6"
              >
                <path
                  fillRule="evenodd"
                  d="M18.97 3.659a2.25 2.25 0 00-3.182 0l-10.94 10.94a3.75 3.75 0 105.304 5.303l7.693-7.693a.75.75 0 011.06 1.06l-7.693 7.693a5.25 5.25 0 11-7.424-7.424l10.939-10.94a3.75 3.75 0 115.303 5.304L9.097 18.835l-.008.008-.007.007-.002.002-.003.002A2.25 2.25 0 015.91 15.66l7.81-7.81a.75.75 0 011.061 1.06l-7.81 7.81a.75.75 0 001.054 1.068L18.97 6.84a2.25 2.25 0 000-3.182z"
                  clipRule="evenodd"
                />
              </svg>
            </label>
            <button
              type="submit"
              className="bg-blue-500 p-2 text-white rounded-sm"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

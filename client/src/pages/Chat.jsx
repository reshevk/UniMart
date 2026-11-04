
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { ArrowLeft, Send, MessageCircle, Package } from "lucide-react";
import API from "../api";

const SOCKET_URL =
  import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, "") ||
  "http://localhost:5001";

export default function Chat({ user }) {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("productId");

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messagesConversationId, setMessagesConversationId] = useState(null);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const socketRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("unimart_token");

    if (!token) {
      navigate("/login");
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("Chat connection error:", err.message);
    });

    socket.on("new_message", async (newMessage) => {
      const isCurrentConversation =
        newMessage.conversationId === conversationId;

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === newMessage.conversationId
            ? {
                ...conversation,
                messages: [newMessage],
                updatedAt: newMessage.createdAt,
                unreadCount:
                  newMessage.senderId !== user?.id && !isCurrentConversation
                    ? (conversation.unreadCount || 0) + 1
                    : conversation.unreadCount || 0,
              }
            : conversation
        )
      );

      if (isCurrentConversation) {
        try {
          const response = await API.get(
            `/chat/conversations/${conversationId}/messages`
          );

          setMessages(response.data.messages || []);
          setMessagesConversationId(conversationId);

          setConversations((previous) =>
            previous.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation
            )
          );
        } catch (err) {
          console.error("Could not refresh messages:", err);
        }
      } else if (newMessage.senderId === user?.id) {
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === newMessage.conversationId
              ? {
                  ...conversation,
                  unreadCount: conversation.unreadCount || 0,
                }
              : conversation
          )
        );
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [navigate, conversationId, user?.id]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      try {
        setLoading(true);
        setError("");

        const response = await API.get("/chat/conversations");

        if (!cancelled) {
          setConversations(response.data.conversations || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || "Could not load conversations."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadConversations();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    if (!productId) return;

    let cancelled = false;

    async function startConversation() {
      try {
        setError("");

        const response = await API.post("/chat/conversations", {
          productId,
        });

        if (!cancelled) {
          navigate(`/chat/${response.data.conversation.id}`, {
            replace: true,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || "Could not start this conversation."
          );
        }
      }
    }

    startConversation();

    return () => {
      cancelled = true;
    };
  }, [productId, navigate]);

  useEffect(() => {
    if (!conversationId) return;

    let cancelled = false;

    async function loadMessages() {
      try {
        setError("");

        const response = await API.get(
          `/chat/conversations/${conversationId}/messages`
        );

        if (!cancelled) {
          setMessages(response.data.messages || []);
          setMessagesConversationId(conversationId);

          setConversations((previous) =>
            previous.map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err.response?.data?.message || "Could not load messages."
          );
          setMessages([]);
          setMessagesConversationId(conversationId);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const visibleMessages = useMemo(
    () =>
      messagesConversationId === conversationId ? messages : [],
    [messagesConversationId, conversationId, messages]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages]);

  const activeConversation = conversations.find(
    (conversation) => conversation.id === conversationId
  );

  const otherPerson = activeConversation
    ? activeConversation.buyerId === user?.id
      ? activeConversation.seller
      : activeConversation.buyer
    : null;

  async function sendMessage(event) {
    event.preventDefault();

    const content = messageText.trim();

    if (!content || !conversationId || sending) return;

    try {
      setSending(true);
      setError("");

      const response = await API.post(
        `/chat/conversations/${conversationId}/messages`,
        { content }
      );

      const sentMessage = response.data.message;

      setMessages((previous) => {
        if (previous.some((message) => message.id === sentMessage.id)) {
          return previous;
        }

        return [...previous, sentMessage];
      });

      setMessagesConversationId(conversationId);
      setMessageText("");

      setConversations((previous) =>
        previous.map((conversation) =>
          conversation.id === conversationId
            ? {
                ...conversation,
                messages: [sentMessage],
                updatedAt: sentMessage.createdAt,
                unreadCount: 0,
              }
            : conversation
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  function getOtherPerson(conversation) {
    return conversation.buyerId === user?.id
      ? conversation.seller
      : conversation.buyer;
  }

  function getLastMessage(conversation) {
    return conversation.messages?.[0]?.content || "Start a conversation";
  }

  return (
    <div className="min-h-screen bg-[#f4faf6]">
      <header className="flex items-center justify-between border-b border-green-100 bg-white px-5 py-4">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 font-bold text-[#075c3b]"
        >
          <ArrowLeft size={20} />
          UniMArt
        </button>

        <h1 className="flex items-center gap-2 font-bold text-[#18352a]">
          <MessageCircle size={20} />
          Student Chat
        </h1>
      </header>

      {error && (
        <div className="mx-auto mt-4 max-w-6xl rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <main className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:h-[calc(100vh-80px)] md:flex-row">
        <aside className="flex w-full flex-col overflow-hidden rounded-2xl border border-green-100 bg-white md:w-80">
          <div className="border-b border-green-100 p-4">
            <h2 className="text-lg font-bold text-[#18352a]">
              Your Conversations
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Chat with other SST students
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-5 text-center text-sm text-gray-500">
                Loading conversations...
              </p>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <MessageCircle className="mx-auto mb-3" size={32} />
                <p className="font-medium">No conversations yet</p>
                <p className="mt-1 text-xs">
                  Open a product and start chatting with its seller.
                </p>
              </div>
            ) : (
              conversations.map((conversation) => {
                const person = getOtherPerson(conversation);
                const active = conversation.id === conversationId;
                const unreadCount = conversation.unreadCount || 0;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => navigate(`/chat/${conversation.id}`)}
                    className={`w-full border-b border-green-50 p-4 text-left transition hover:bg-green-50 ${
                      active ? "bg-green-50" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-[#18352a]">
                        {person?.name || "Student"}
                      </span>

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {conversation.updatedAt
                            ? new Date(
                                conversation.updatedAt
                              ).toLocaleDateString()
                            : ""}
                        </span>

                        {unreadCount > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#16865a] px-1.5 text-[10px] font-bold text-white">
                            {unreadCount > 99 ? "99+" : unreadCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="mt-1 truncate text-sm text-gray-500">
                      {conversation.product?.title}
                    </p>

                    <p
                      className={`mt-1 truncate text-xs ${
                        unreadCount > 0
                          ? "font-semibold text-[#18352a]"
                          : "text-gray-400"
                      }`}
                    >
                      {getLastMessage(conversation)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[450px] flex-1 flex-col overflow-hidden rounded-2xl border border-green-100 bg-white">
          {!conversationId ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-gray-400">
              <MessageCircle size={52} strokeWidth={1.3} />
              <h2 className="mt-4 text-lg font-semibold text-[#18352a]">
                Your messages
              </h2>
              <p className="mt-2 text-sm">
                Select a conversation to start chatting.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-green-100 p-4">
                <div className="rounded-full bg-green-100 p-3 text-[#16865a]">
                  <MessageCircle size={20} />
                </div>

                <div className="min-w-0">
                  <h2 className="font-bold text-[#18352a]">
                    {otherPerson?.name || "Student"}
                  </h2>

                  <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                    <Package size={13} />
                    {activeConversation?.product?.title ||
                      "Product conversation"}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-[#f8fcf9] p-4">
                {visibleMessages.map((message) => {
                  const mine = message.senderId === user?.id;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        mine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          mine
                            ? "rounded-br-sm bg-[#16865a] text-white"
                            : "rounded-bl-sm border border-green-100 bg-white text-[#18352a]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {message.content}
                        </p>

                        <p
                          className={`mt-1 text-right text-[10px] ${
                            mine ? "text-green-100" : "text-gray-400"
                          }`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {visibleMessages.length === 0 && (
                  <p className="py-10 text-center text-sm text-gray-400">
                    No messages yet. Say hello!
                  </p>
                )}

                <div ref={bottomRef} />
              </div>

              <form
                onSubmit={sendMessage}
                className="flex items-center gap-2 border-t border-green-100 p-3"
              >
                <input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  placeholder="Write a message..."
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-full border border-green-100 bg-[#f8fcf9] px-4 py-3 text-sm outline-none focus:border-[#16865a]"
                />

                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className="rounded-full bg-[#16865a] p-3 text-white transition hover:bg-[#075c3b] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

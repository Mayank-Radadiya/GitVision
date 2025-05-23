"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2,
  Send,
  PanelRight,
  Bot,
  Sparkles,
  LucideIcon,
  ArrowDown,
  MessageSquareText,
} from "lucide-react";
import ChatSidebar from "@/components/chat/chat-sidebar";
import { AnimatePresence, motion } from "framer-motion";

const suggestedPrompts = [
  {
    title: "Explain Code",
    prompt: "Can you explain how this code works?",
    icon: Sparkles,
  },
  {
    title: "Add Feature",
    prompt: "How can I implement authentication?",
    icon: Sparkles,
  },
  {
    title: "Fix Error",
    prompt: "I'm getting this error. How do I fix it?",
    icon: Sparkles,
  },
  {
    title: "Architecture",
    prompt: "What's the best way to structure my project?",
    icon: Sparkles,
  },
];

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle scroll events to show/hide scroll-to-bottom button
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    // Show button if not at the bottom
    setShowScrollButton(scrollTop < scrollHeight - clientHeight - 100);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePromptClick = (promptText: string) => {
    // Set the input value to the clicked prompt text
    handleInputChange({
      target: { value: promptText },
    } as React.ChangeEvent<HTMLInputElement>);
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-background to-background/95">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <header className="border-b py-3 px-4 flex items-center justify-between bg-background/50 backdrop-blur-sm">
          <div className="flex items-center">
            <Avatar className="h-8 w-8 mr-3">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </div>
            </Avatar>
            <div>
              <h1 className="font-semibold text-lg">AI Assistant</h1>
              <p className="text-sm text-muted-foreground">
                Chat with your AI assistant
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarVisible(!sidebarVisible)}
              className="relative"
            >
              <PanelRight className="h-4 w-4" />

              {!sidebarVisible && (
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-4 md:py-6 md:px-8  mx-auto w-full">
          <Card className="flex-1 w-full flex flex-col border-muted/50 bg-card backdrop-blur-sm shadow-md">
            <CardContent className="flex-1 p-0 overflow-hidden relative">
              <ScrollArea
                className="h-[calc(100vh-18rem)] px-6"
                ref={scrollAreaRef}
                onScroll={handleScroll}
              >
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 px-4 text-center">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                      <Bot className="h-10 w-10 text-primary" />
                    </div>
                    <h3 className="text-lg font-medium mb-2">
                      How can I help you today?
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mb-8">
                      Ask questions about your code, get explanations, or
                      request assistance with your projects.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl">
                      {suggestedPrompts.map((item, index) => (
                        <SuggestedPrompt
                          key={index}
                          title={item.title}
                          prompt={item.prompt}
                          icon={item.icon}
                          onClick={() => handlePromptClick(item.prompt)}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4 pb-6">
                    <AnimatePresence initial={false}>
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`flex ${
                            message.role === "user"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`flex gap-3 max-w-[80%] ${
                              message.role === "user" ? "flex-row-reverse" : ""
                            }`}
                          >
                            <Avatar className="h-8 w-8 mt-1">
                              <div
                                className={`flex h-full w-full items-center justify-center rounded-full text-sm ${
                                  message.role === "user"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {message.role === "user" ? "You" : "AI"}
                              </div>
                            </Avatar>
                            <div
                              className={`rounded-lg px-4 py-2 shadow-sm ${
                                message.role === "user"
                                  ? "bg-[#303030] text-primary-foreground rounded-tr-none"
                                  : "bg-muted rounded-tl-none"
                              }`}
                            >
                              <div className="whitespace-pre-wrap prose prose-sm max-w-none">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Scroll to bottom button */}
              <AnimatePresence>
                {showScrollButton && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-4 right-4"
                  >
                    <Button
                      size="icon"
                      variant="secondary"
                      className="rounded-full shadow-md"
                      onClick={scrollToBottom}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>

            <CardFooter className="border-t p-4 px-6 bg-card/10">
              <form
                onSubmit={handleSubmit}
                className="flex w-full gap-2 items-end"
              >
                <div className="relative flex-1">
                  <MessageSquareText className="absolute top-3 left-4 size-5 text-muted-foreground m-1" />
                  <Input
                    value={input}
                    onChange={handleInputChange}
                    placeholder="Type your message..."
                    disabled={isLoading}
                    className="flex-1 py-6 rounded-full  text-sm  border-muted bg-background shadow-sm focus-visible:ring-0 pl-13"
                    name="message"
                    autoComplete="off" // This disables browser autofill/suggestions
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading}
                  size="icon"
                  className="h-12 w-12 rounded-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </Button>
              </form>
            </CardFooter>
          </Card>
        </main>
      </div>

      {/* Chat Sidebar */}
      <ChatSidebar
        isVisible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
      />

      {/* Mobile overlay */}
      {sidebarVisible && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setSidebarVisible(false)}
        />
      )}
    </div>
  );
}

interface SuggestedPromptProps {
  title: string;
  prompt: string;
  icon: LucideIcon;
  onClick: () => void;
}

function SuggestedPrompt({
  title,
  prompt,
  icon: Icon,
  onClick,
}: SuggestedPromptProps) {
  return (
    <Button
      variant="outline"
      className="flex flex-col items-start h-24 p-4 border-muted/50 bg-background shadow-sm hover:bg-muted/10 hover:border-primary/20 transition-all"
      onClick={onClick}
    >
      <div className="flex flex-col justify-between h-full">
        <div className="flex items-center mb-1 text-primary">
          <Icon className="h-4 w-4 mr-2" />
          <span className="font-medium">{title}</span>
        </div>
        <p className="text-sm text-muted-foreground whitespace-normal break-words">
          {prompt}
        </p>
      </div>
    </Button>
  );
}

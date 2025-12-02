"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Image as ImageIcon, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { AIService, AIProvider } from "@/lib/ai"

interface ChatInterfaceProps {
    projectId: string
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

export function ChatInterface({ projectId }: ChatInterfaceProps) {
    // Use projectId to load chat history later
    console.log("Chat for project:", projectId)
    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Hello! I am your AI design assistant. Configure your AI provider in settings to get started.' }
    ])
    const [isLoading, setIsLoading] = useState(false)

    // Settings state
    const [provider, setProvider] = useState<AIProvider>('gemini')
    const [apiKey, setApiKey] = useState("")
    const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434")
    const [isSettingsOpen, setIsSettingsOpen] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Load settings from localStorage
        const savedProvider = localStorage.getItem('ai_provider') as AIProvider
        const savedKey = localStorage.getItem('ai_api_key')
        const savedUrl = localStorage.getItem('ai_ollama_url')

        if (savedProvider) setProvider(savedProvider)
        if (savedKey) setApiKey(savedKey)
        if (savedUrl) setOllamaUrl(savedUrl)
    }, [])

    const saveSettings = () => {
        localStorage.setItem('ai_provider', provider)
        localStorage.setItem('ai_api_key', apiKey)
        localStorage.setItem('ai_ollama_url', ollamaUrl)
        setIsSettingsOpen(false)
    }

    const handleSend = async () => {
        if (!input.trim() || isLoading) return

        const userMsg = input
        setInput("")
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setIsLoading(true)

        try {
            const ai = new AIService({
                provider,
                apiKey,
                baseUrl: ollamaUrl
            })

            let assistantMsg = ""
            setMessages(prev => [...prev, { role: 'assistant', content: "" }])

            await ai.generateStream(userMsg, (chunk) => {
                assistantMsg += chunk
                setMessages(prev => {
                    const newMsgs = [...prev]
                    newMsgs[newMsgs.length - 1].content = assistantMsg
                    return newMsgs
                })
            })
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }])
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex justify-between items-center">
                <h2 className="font-semibold">AI Designer</h2>
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>AI Settings</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <label>Provider</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value as AIProvider)}
                                >
                                    <option value="gemini">Google Gemini</option>
                                    <option value="ollama">Ollama (Local)</option>
                                </select>
                            </div>

                            {provider === 'gemini' && (
                                <div className="grid gap-2">
                                    <label>API Key</label>
                                    <Input
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        placeholder="Gemini API Key"
                                    />
                                </div>
                            )}

                            {provider === 'ollama' && (
                                <div className="grid gap-2">
                                    <label>Base URL</label>
                                    <Input
                                        value={ollamaUrl}
                                        onChange={(e) => setOllamaUrl(e.target.value)}
                                        placeholder="http://localhost:11434"
                                    />
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button onClick={saveSettings}>Save Settings</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4" ref={scrollRef}>
                    {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 whitespace-pre-wrap ${msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 border-t mt-auto">
                <div className="flex gap-2">
                    <Button variant="outline" size="icon">
                        <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={provider === 'gemini' && !apiKey ? "Please configure API Key" : "Describe your UI..."}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        disabled={isLoading || (provider === 'gemini' && !apiKey)}
                    />
                    <Button onClick={handleSend} size="icon" disabled={isLoading || (provider === 'gemini' && !apiKey)}>
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    )
}

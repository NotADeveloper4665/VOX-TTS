import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Loader2, Mic, Terminal, ChevronDown, ChevronUp } from 'lucide-react';
import { AVAILABLE_VOICES, VoiceName } from './types';
import { generateSpeech } from './services/gemini';
import { decodeBase64, decodeAudioData } from './utils/audio';
import Waveform from './components/Waveform';

const App: React.FC = () => {
  const [text, setText] = useState<string>('Greetings! I am powered by Gemini. How can I help you today?');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Kore');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasUnplayedAudio, setHasUnplayedAudio] = useState(false);
  
  // Status and logs
  const [logs, setLogs] = useState<{time: string, msg: string}[]>([]);
  const [progress, setProgress] = useState(0);
  const [isStatusCollapsed, setIsStatusCollapsed] = useState(false);

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  
  // Refs for audio handling
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    setLogs(prev => [...prev, { time, msg }]);
  };

  // Initialize AudioContext on first user interaction to comply with browser policies
  const initAudioContext = () => {
    if (!audioContext) {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000, // Gemini TTS sample rate
      });
      const anal = ctx.createAnalyser();
      anal.fftSize = 2048;
      setAudioContext(ctx);
      setAnalyser(anal);
    } else if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    
    // Stop any current playback
    handleStop();
    setLogs([]); // Clear previous logs for fresh run
    setIsGenerating(true);
    setHasUnplayedAudio(false);
    setProgress(0);
    // Auto-expand logs when generating so user sees progress
    setIsStatusCollapsed(false);
    
    addLog(`Initializing request for voice: ${selectedVoice}...`);
    addLog(`Payload size: ${text.length} chars`);

    // Simulated progress bar since we don't get stream events for simple generation
    const progressInterval = setInterval(() => {
      setProgress(old => {
        if (old >= 90) return old;
        // Slow down as we get closer to 90
        const increment = Math.max(1, (90 - old) / 10); 
        return old + increment;
      });
    }, 200);

    try {
        // Ensure context is ready before we need to decode
        let ctx = audioContext;
        if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: 24000,
            });
            const anal = ctx.createAnalyser();
            anal.fftSize = 2048;
            setAudioContext(ctx);
            setAnalyser(anal);
        }

        addLog("Sending request to Gemini API...");
        const base64Audio = await generateSpeech(text, selectedVoice);
        
        clearInterval(progressInterval);
        setProgress(100);
        addLog("Response received. Decoding PCM data...");

        const rawBytes = decodeBase64(base64Audio);
        
        // Decode raw PCM
        const buffer = await decodeAudioData(rawBytes, ctx!, 24000, 1);
        audioBufferRef.current = buffer;
        
        addLog(`Decoding complete. Audio duration: ${buffer.duration.toFixed(2)}s`);
        
        // Set unplayed state so the green dot appears
        setHasUnplayedAudio(true);
        addLog("Ready to play.");
        
    } catch (error) {
        clearInterval(progressInterval);
        setProgress(0);
        console.error("Failed to generate speech", error);
        addLog(`Error: ${(error as Error).message}`);
        alert("Failed to generate speech. Please check your API key or network connection.");
    } finally {
        setIsGenerating(false);
    }
  };

  const playBuffer = (buffer: AudioBuffer, ctx: AudioContext, anal: AnalyserNode) => {
    if (audioSourceRef.current) {
        try {
            audioSourceRef.current.stop();
        } catch (e) { /* ignore if already stopped */ }
    }

    addLog("Starting playback...");
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    
    // Connect Source -> Analyser -> Destination
    source.connect(anal);
    anal.connect(ctx.destination);
    
    source.onended = () => {
        setIsPlaying(false);
        addLog("Playback finished.");
    };

    source.start();
    audioSourceRef.current = source;
    setIsPlaying(true);
  };

  const handlePlay = () => {
    initAudioContext();
    // Mark as played immediately when play starts
    setHasUnplayedAudio(false);
    
    if (audioBufferRef.current && audioContext && analyser) {
        // If already playing, stop and restart
        playBuffer(audioBufferRef.current, audioContext, analyser);
    }
  };

  const handleStop = () => {
    if (audioSourceRef.current) {
        try {
            audioSourceRef.current.stop();
        } catch (e) {
            // ignore
        }
        audioSourceRef.current = null;
    }
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 sm:p-8 font-sans text-slate-200">
      
      {/* Main Card */}
      <div className="w-full max-w-5xl bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 overflow-hidden flex flex-col md:flex-row mb-6">
        
        {/* Left Panel: Controls & Visuals */}
        <div className="w-full md:w-5/12 p-6 md:p-8 flex flex-col gap-6 border-b md:border-b-0 md:border-r border-slate-700">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <span className="p-2 bg-indigo-500 rounded-lg shadow-lg shadow-indigo-500/20">
                <Mic className="w-6 h-6 text-white" />
              </span>
              Vox
            </h1>
          </div>

          {/* Voice Selection */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Voice Persona
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {AVAILABLE_VOICES.map((voice) => (
                <button
                  key={voice.name}
                  onClick={() => {
                      setSelectedVoice(voice.name);
                      handleStop(); 
                  }}
                  className={`
                    w-full flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 text-left
                    ${selectedVoice === voice.name 
                        ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.15)]' 
                        : 'bg-slate-750 border-slate-700 hover:border-slate-600 hover:bg-slate-700/50'
                    }
                  `}
                >
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${selectedVoice === voice.name ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'}
                  `}>
                    {voice.name[0]}
                  </div>
                  <div>
                    <div className={`text-sm font-medium ${selectedVoice === voice.name ? 'text-indigo-300' : 'text-slate-200'}`}>
                      {voice.name}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wide">
                        {voice.gender} • {voice.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Visualizer & Audio Actions */}
          <div className="mt-auto">
             <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 flex flex-col items-center gap-6">
                
                {/* Visualizer */}
                <div className="w-full flex justify-center py-2 relative">
                    <Waveform analyser={analyser} isPlaying={isPlaying} />
                </div>

                {/* Buttons */}
                <div className="flex w-full gap-3">
                    <button
                        onClick={handlePlay}
                        disabled={!audioBufferRef.current || isPlaying}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold shadow-lg shadow-indigo-500/10 active:scale-95"
                    >
                        <div className={`w-2.5 h-2.5 rounded-full mr-1 transition-colors duration-300 ${
                            hasUnplayedAudio ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]' : 'bg-slate-600'
                        }`} />
                        <Play className="w-5 h-5 fill-current" />
                        Play
                    </button>
                    <button
                        onClick={handleStop}
                        disabled={!isPlaying}
                        className="flex-1 bg-slate-700 hover:bg-red-500/20 hover:text-red-200 hover:border-red-500/50 border border-transparent disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-all font-semibold active:scale-95"
                    >
                        <Square className="w-5 h-5 fill-current" />
                        Stop
                    </button>
                </div>
             </div>
          </div>
        </div>

        {/* Right Panel: Text Input */}
        <div className="w-full md:w-7/12 p-6 md:p-8 flex flex-col bg-slate-900/30">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Input Sequence
          </label>
          <div className="flex-grow relative group">
            <textarea
              className="w-full h-full min-h-[300px] bg-slate-800/80 text-slate-200 border-2 border-slate-700 rounded-2xl p-6 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-lg leading-relaxed placeholder-slate-600 custom-scrollbar"
              placeholder="Enter text to synthesize..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="absolute bottom-4 right-4 text-xs text-slate-500 font-mono bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700">
              {text.length} chars
            </div>
          </div>
          
          <div className="mt-6">
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !text.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 transition-all active:scale-[0.99] flex items-center justify-center gap-3"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Synthesize Audio
                  <span className="hidden sm:inline-block bg-indigo-500 px-2 py-0.5 rounded text-xs font-normal opacity-80 border border-indigo-400/30">
                    ⌘ + Enter
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Status Console Box */}
      <div className="w-full max-w-5xl bg-black rounded-xl border border-slate-800 overflow-hidden font-mono text-xs shadow-lg transition-all duration-300">
        {/* Header - Clickable for collapse */}
        <button 
            onClick={() => setIsStatusCollapsed(!isStatusCollapsed)}
            className={`w-full bg-slate-900 px-4 py-2 flex justify-between items-center hover:bg-slate-800 transition-colors ${!isStatusCollapsed ? 'border-b border-slate-800' : ''}`}
        >
            <div className="flex items-center gap-2 text-slate-400">
                {isStatusCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                <Terminal className="w-4 h-4" />
                <span>Vox Activity Log</span>
            </div>
            <div className="flex items-center gap-2 w-1/3">
                 <span className="text-slate-500">{Math.round(progress)}%</span>
                 <div className="h-1.5 flex-1 bg-slate-800 rounded-full overflow-hidden">
                     <div 
                        className="h-full bg-indigo-500 transition-all duration-200 ease-out"
                        style={{ width: `${progress}%` }}
                     />
                 </div>
            </div>
        </button>
        
        {/* Logs - Collapsible Area */}
        <div className={`transition-all duration-300 ease-in-out bg-black overflow-hidden ${isStatusCollapsed ? 'max-h-0 opacity-0' : 'max-h-40 opacity-100'}`}>
            <div className="h-40 overflow-y-auto p-4 space-y-1 custom-scrollbar">
                {logs.length === 0 && (
                    <div className="text-slate-600 italic">System ready. Waiting for input...</div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 text-slate-300">
                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                        <span className={log.msg.includes('Error') ? 'text-red-400' : 'text-slate-300'}>
                            {log.msg}
                        </span>
                    </div>
                ))}
                <div id="log-end" />
            </div>
        </div>
      </div>

    </div>
  );
};

export default App;
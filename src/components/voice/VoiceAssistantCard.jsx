import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Sparkles, 
  Info, 
  ArrowUpRight, 
  Volume2, 
  Square, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Languages,
  Calendar,
  Clock,
  MapPin,
  Car,
  X
} from 'lucide-react';
import AudioWaveform from './AudioWaveform';
import { VOICE_EXAMPLE_PROMPTS } from '../../data/mockData';
import { api } from '../../api/client';
import { useBookings } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/pricing';

export default function VoiceAssistantCard({ onSelectExamplePrompt, onBookingCreated }) {
  const { user } = useAuth();
  const { refreshFromBackend } = useBookings();

  // Assistant states: 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking'
  const [assistantState, setAssistantState] = useState('idle');
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN'); // 'en-IN' | 'hi-IN' | 'kn-IN'
  const [backendVoiceStatus, setBackendVoiceStatus] = useState(null);

  // Transcript and conversation state
  const [lastUserSpeech, setLastUserSpeech] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [pendingAction, setPendingAction] = useState(null); // { type, data, booking_id }
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);

  // MediaRecorder & Audio elements
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioPlayerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isTranscribingRef = useRef(false);

  // Fetch backend voice status on mount
  useEffect(() => {
    isMountedRef.current = true;
    async function checkStatus() {
      try {
        const status = await api.getVoiceStatus();
        if (isMountedRef.current) {
          setBackendVoiceStatus(status);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setBackendVoiceStatus({ configured: false, message: 'Voice server offline.' });
        }
      }
    }
    checkStatus();

    return () => {
      isMountedRef.current = false;
      stopAudioPlayback();
      stopMicrophone();
    };
  }, []);

  const stopAudioPlayback = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current = null;
    }
    if (assistantState === 'speaking') {
      setAssistantState('idle');
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Safe cleanup
      }
    }
  };

  // -------------------------------------------------------------------------
  // Speech Output (Gnani Timbre TTS)
  // -------------------------------------------------------------------------
  const speakAssistantResponse = async (textToSpeak) => {
    if (!textToSpeak) return;
    stopAudioPlayback();

    try {
      setAssistantState('speaking');
      const audioUrl = await api.synthesizeSpeech({
        text: textToSpeak,
        voice: backendVoiceStatus?.tts_voice || 'Nalini',
        languageCode: selectedLanguage,
      });

      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;

      audio.onended = () => {
        if (isMountedRef.current) setAssistantState('idle');
      };

      audio.onerror = () => {
        if (isMountedRef.current) setAssistantState('idle');
      };

      await audio.play();
    } catch (err) {
      // If TTS fails (e.g. backend credentials unconfigured), gracefully fallback to text
      console.warn('Gnani Timbre TTS playback unavailable:', err.message);
      if (isMountedRef.current) setAssistantState('idle');
    }
  };

  // -------------------------------------------------------------------------
  // Process User Query through Assistant Conversational API
  // -------------------------------------------------------------------------
  const processUserQuery = async (queryText) => {
    if (!queryText || !queryText.trim()) {
      setAssistantState('idle');
      return;
    }

    setLastUserSpeech(queryText);
    setAssistantState('thinking');
    setErrorNotice(null);

    try {
      const response = await api.sendVoiceChat({
        message: queryText,
      });

      if (!isMountedRef.current) return;

      setAssistantReply(response.reply_text);

      if (response.requires_confirmation && response.action_data) {
        setPendingAction({
          type: response.action_type,
          data: response.action_data,
        });
      } else {
        setPendingAction(null);
      }

      // Synthesize spoken voice output
      await speakAssistantResponse(response.reply_text);
    } catch (err) {
      if (isMountedRef.current) {
        setErrorNotice(err.message || 'Failed to process voice query.');
        setAssistantState('idle');
      }
    }
  };

  // -------------------------------------------------------------------------
  // Speech Input Recording (Gnani Prisma STT)
  // -------------------------------------------------------------------------
  const startRecording = async () => {
    if (isTranscribingRef.current || assistantState === 'transcribing' || assistantState === 'thinking') {
      return;
    }
    stopAudioPlayback();
    setErrorNotice(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorNotice('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      // Determine supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/wav')
        ? 'audio/wav'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());

        if (audioChunksRef.current.length === 0) {
          if (isMountedRef.current) setAssistantState('idle');
          return;
        }

        // Avoid duplicate transcription requests
        if (isTranscribingRef.current) return;
        isTranscribingRef.current = true;

        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, {
          type: actualMime,
        });

        if (isMountedRef.current) {
          setAssistantState('transcribing');
        }

        try {
          // Send audio payload to FastAPI Gnani Prisma STT endpoint
          const sttResult = await api.transcribeAudio(audioBlob, selectedLanguage);
          if (sttResult.success && sttResult.transcript) {
            await processUserQuery(sttResult.transcript);
          } else {
            setErrorNotice('Could not recognize speech clearly. Please try again or tap a sample route.');
            if (isMountedRef.current) setAssistantState('idle');
          }
        } catch (err) {
          if (isMountedRef.current) {
            let msg = err.message || 'Speech recognition failed.';
            // Clean any residual HTML
            if (msg.includes('<') && msg.includes('>')) {
              msg = msg.replace(/<[^>]+>/g, '').trim();
            }
            if (msg.includes('504') || msg.toLowerCase().includes('timed out')) {
              msg = 'Gnani voice service timed out (upstream gateway 504). You can tap any sample trip below or try speaking again.';
            } else if (msg.includes('502')) {
              msg = 'Gnani voice service is currently unreachable (upstream 502). Please try again in a moment or tap a sample route.';
            }
            setErrorNotice(msg);
            setAssistantState('idle');
          }
        } finally {
          isTranscribingRef.current = false;
        }
      };

      recorder.start();
      setAssistantState('listening');
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorNotice('Microphone permission was denied. Please allow microphone access in your browser.');
      } else {
        setErrorNotice(`Microphone error: ${err.message || 'Unable to access microphone.'}`);
      }
      setAssistantState('idle');
    }
  };

  const handleToggleMic = () => {
    if (isTranscribingRef.current || assistantState === 'transcribing' || assistantState === 'thinking') {
      return;
    }
    if (assistantState === 'listening') {
      stopMicrophone();
    } else if (assistantState === 'speaking') {
      stopAudioPlayback();
    } else if (assistantState === 'idle') {
      startRecording();
    }
  };

  // -------------------------------------------------------------------------
  // Action Confirmation Handlers
  // -------------------------------------------------------------------------
  const handleConfirmAction = async () => {
    if (!pendingAction) return;
    setIsConfirmingAction(true);
    setErrorNotice(null);

    try {
      const response = await api.sendVoiceChat({
        message: 'Confirm action',
        confirmAction: true,
        pendingAction: pendingAction,
      });

      setAssistantReply(response.reply_text);
      setPendingAction(null);
      refreshFromBackend();

      if (response.booking && onBookingCreated) {
        onBookingCreated(response.booking);
      }

      await speakAssistantResponse(response.reply_text);
    } catch (err) {
      setErrorNotice(err.message || 'Failed to execute confirmed action.');
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setAssistantReply('Action was cancelled. How else can I assist you today?');
    speakAssistantResponse('Action was cancelled. How else can I assist you today?');
  };

  const handlePromptClick = (prompt) => {
    stopAudioPlayback();
    // Process query directly through assistant engine
    processUserQuery(prompt.text);
    if (onSelectExamplePrompt) {
      onSelectExamplePrompt(prompt);
    }
  };

  const isGnaniConfigured = Boolean(backendVoiceStatus?.configured);

  return (
    <div className="dm-card p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-brand-navy dark:bg-brand-sky animate-ping" />
          <span className="text-xs uppercase tracking-wider font-extrabold text-brand-navy dark:text-brand-sky">
            Gnani AI Voice Concierge
          </span>
        </div>

        {/* Language selector & status indicator */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-brand-navy-dark border border-slate-200 dark:border-brand-navy-border text-xs">
            <Languages className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-transparent text-[11px] font-bold text-brand-dark dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="en-IN" className="bg-white dark:bg-brand-navy">English (India)</option>
              <option value="hi-IN" className="bg-white dark:bg-brand-navy">हिन्दी (Hindi)</option>
              <option value="kn-IN" className="bg-white dark:bg-brand-navy">ಕನ್ನಡ (Kannada)</option>
            </select>
          </div>

          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border ${
            isGnaniConfigured
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isGnaniConfigured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span>{isGnaniConfigured ? 'Gnani Prisma & Timbre Live' : 'Gnani STT/TTS Ready'}</span>
          </div>
        </div>
      </div>

      {/* Main prompt heading */}
      <div className="text-center max-w-xl mx-auto mb-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy dark:text-white tracking-tight mb-2">
          &ldquo;Where would you like your driver to take you?&rdquo;
        </h2>
        <p className="text-xs sm:text-sm text-brand-muted dark:text-slate-300">
          Speak naturally in your preferred language to schedule a chauffeur, check your active ride status, or calculate fares.
        </p>
      </div>

      {/* Audio Waveform visualization */}
      <div className="my-2">
        <AudioWaveform isListening={assistantState === 'listening' || assistantState === 'speaking'} />
      </div>

      {/* Central Interactive Microphone Button */}
      <div className="flex flex-col items-center justify-center my-6">
        <div className="relative">
          <button
            type="button"
            onClick={handleToggleMic}
            disabled={assistantState === 'transcribing' || assistantState === 'thinking'}
            aria-label={
              assistantState === 'listening'
                ? 'Stop listening'
                : assistantState === 'speaking'
                ? 'Stop audio'
                : 'Start microphone'
            }
            className={`relative group flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 focus:outline-none cursor-pointer ${
              assistantState === 'listening'
                ? 'bg-rose-600 text-white ring-4 ring-rose-300 dark:ring-rose-800 scale-105 shadow-elevated'
                : assistantState === 'speaking'
                ? 'bg-emerald-600 text-white ring-4 ring-emerald-300 dark:ring-emerald-800 shadow-elevated'
                : 'bg-brand-sky text-brand-navy border-2 border-brand-sky-border hover:bg-brand-navy hover:text-white hover:scale-105 shadow-sm dark:bg-brand-navy dark:text-brand-sky dark:border-brand-navy-border dark:hover:bg-brand-navy-subtle dark:hover:text-white'
            }`}
          >
            {assistantState === 'listening' ? (
              <MicOff className="w-8 h-8 animate-pulse" />
            ) : assistantState === 'speaking' ? (
              <Volume2 className="w-8 h-8 animate-bounce" />
            ) : assistantState === 'transcribing' || assistantState === 'thinking' ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Mic className="w-8 h-8 transition-transform group-hover:scale-110" />
            )}

            {assistantState === 'listening' && (
              <span className="absolute inset-0 rounded-full border-2 border-rose-500 animate-ping opacity-75 pointer-events-none" />
            )}
          </button>
        </div>

        {/* State Label */}
        <div className="mt-4 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-muted dark:text-slate-400">
            {assistantState === 'listening' ? (
              <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 justify-center">
                <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                Listening... Tap to stop speaking
              </span>
            ) : assistantState === 'transcribing' ? (
              <span className="text-brand-navy dark:text-brand-sky flex items-center gap-1.5 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Transcribing with Gnani Prisma STT...
              </span>
            ) : assistantState === 'thinking' ? (
              <span className="text-brand-navy dark:text-brand-sky flex items-center gap-1.5 justify-center">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing request...
              </span>
            ) : assistantState === 'speaking' ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 justify-center">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                Playing Gnani Timbre Audio (tap mic to stop)
              </span>
            ) : (
              'Click microphone to speak or tap a sample route below'
            )}
          </span>
        </div>
      </div>

      {/* Error feedback banner */}
      {errorNotice && (
        <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2 max-w-xl mx-auto">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span className="flex-1">{errorNotice}</span>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="text-rose-400 hover:text-rose-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Active Conversation Transcript Display */}
      {(lastUserSpeech || assistantReply) && (
        <div className="mb-6 p-4 rounded-xl bg-brand-grey-subtle dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border max-w-xl mx-auto space-y-3 text-xs animate-in fade-in duration-200">
          {lastUserSpeech && (
            <div className="flex items-start gap-2">
              <span className="font-bold text-brand-muted dark:text-slate-400 shrink-0">You:</span>
              <p className="font-semibold text-brand-dark dark:text-white">&ldquo;{lastUserSpeech}&rdquo;</p>
            </div>
          )}

          {assistantReply && (
            <div className="flex items-start gap-2 pt-2 border-t border-slate-200 dark:border-brand-navy-border/80">
              <span className="font-bold text-brand-navy dark:text-brand-sky shrink-0">DriveMate AI:</span>
              <p className="text-brand-dark dark:text-slate-200 leading-relaxed">{assistantReply}</p>
            </div>
          )}

          {assistantState === 'speaking' && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={stopAudioPlayback}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <Square className="w-3 h-3 fill-rose-600" />
                <span>Stop Spoken Audio</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Explicit Voice Action Confirmation Card */}
      {pendingAction && (
        <div className="mb-6 p-5 rounded-2xl bg-brand-sky-light/80 dark:bg-brand-navy border border-brand-sky dark:border-brand-navy-border shadow-elevated max-w-xl mx-auto animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-5 h-5 text-brand-navy dark:text-brand-sky" />
            <h3 className="font-extrabold text-sm text-brand-navy dark:text-white">
              {pendingAction.type === 'create_booking' ? 'Confirm Proposed Driver Booking' : 'Confirm Action'}
            </h3>
          </div>

          {pendingAction.type === 'create_booking' && pendingAction.data && (
            <div className="space-y-2 mb-4 text-xs bg-white dark:bg-brand-navy-dark p-3.5 rounded-xl border border-slate-200 dark:border-brand-navy-border">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-brand-navy dark:text-brand-sky shrink-0 mt-0.5" />
                <span><strong>Pickup:</strong> {pendingAction.data.pickup}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Destination:</strong> {pendingAction.data.destination}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100 dark:border-brand-navy-border">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-brand-muted" />
                  <span>{pendingAction.data.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-brand-muted" />
                  <span>{pendingAction.data.time} ({pendingAction.data.duration}h)</span>
                </div>
              </div>
              {pendingAction.data.estimatedFare && (
                <div className="pt-1.5 border-t border-slate-100 dark:border-brand-navy-border flex justify-between items-center font-bold">
                  <span className="text-brand-muted">Estimated Fare:</span>
                  <span className="text-brand-navy dark:text-brand-sky text-sm">
                    {formatCurrency(pendingAction.data.estimatedFare)}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleConfirmAction}
              disabled={isConfirmingAction}
              className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-brand-navy-hover dark:bg-brand-sky dark:text-brand-navy dark:hover:bg-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isConfirmingAction ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Confirming...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Yes, Confirm & Dispatch</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleCancelAction}
              disabled={isConfirmingAction}
              className="py-2.5 px-4 rounded-xl text-xs font-bold text-brand-dark dark:text-slate-300 bg-white dark:bg-brand-navy-dark hover:bg-slate-100 dark:hover:bg-brand-navy-subtle border border-slate-300 dark:border-brand-navy-border transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Suggested prompts chips */}
      <div>
        <div className="text-xs font-bold text-brand-muted dark:text-slate-400 uppercase tracking-wider mb-2.5">
          Or try a sample voice trip request:
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {VOICE_EXAMPLE_PROMPTS.map((prompt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePromptClick(prompt)}
              className="group text-left p-3.5 rounded-xl bg-white dark:bg-brand-navy-dark/70 border border-slate-200 dark:border-brand-navy-border hover:border-brand-navy dark:hover:border-brand-sky hover:bg-brand-sky-light/40 dark:hover:bg-brand-navy-subtle transition-all text-xs text-brand-dark dark:text-slate-200 flex items-center justify-between gap-2 shadow-xs cursor-pointer"
            >
              <span className="line-clamp-2 font-medium">&ldquo;{prompt.text}&rdquo;</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-brand-muted group-hover:text-brand-navy dark:text-slate-400 dark:group-hover:text-brand-sky shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

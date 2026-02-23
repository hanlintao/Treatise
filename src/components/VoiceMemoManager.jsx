import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, Square, Play, Pause, Wand2, Loader2, Save, Trash2, Clock, FileAudio, FileText
} from 'lucide-react';
import { AudioRecorder } from '../utils/audioRecorder';
import { API_BASE_URL } from '../utils/api';

export function VoiceMemoManager() {
  const [memos, setMemos] = useState([]); // { id, url, text, created_at, duration }
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribingId, setTranscribingId] = useState(null);
  const [generatingId, setGeneratingId] = useState(null);
  
  const recorderRef = useRef(new AudioRecorder());
  const timerRef = useRef(null);
  
  const [savedMemos, setSavedMemos] = useState([]);

  useEffect(() => {
    fetchMemos();
  }, []);

  const fetchMemos = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/voice-memos`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setSavedMemos(data);
      }
    } catch (e) {
      console.error('Failed to fetch voice memos', e);
    }
  };

  const saveMemoToServer = async (memo) => {
    try {
        await fetch(`${API_BASE_URL}/api/voice-memos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(memo)
        });
        fetchMemos(); // Refresh list
    } catch (e) {
        console.error('Failed to save memo', e);
    }
  };

  const startRecording = async () => {
    try {
      await recorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (e) {
      console.error('Error accessing microphone:', e);
      alert('无法访问麦克风');
    }
  };

  const stopRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      clearInterval(timerRef.current);
      const audioBlob = await recorderRef.current.stop();
      handleUpload(audioBlob);
    }
  };

  const handleUpload = async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.wav');

    try {
      const res = await fetch(`${API_BASE_URL}/api/upload-voice`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.success) {
        const newMemo = {
          id: Date.now().toString(),
          url: data.url,
          text: '',
          academicText: '',
          created_at: new Date().toISOString(),
          duration: recordingTime
        };
        await saveMemoToServer(newMemo);
      } else {
        alert('上传失败');
      }
    } catch (e) {
      console.error(e);
      alert('上传出错');
    }
  };

  const handleTranscribe = async (memo) => {
    const volcAppId = localStorage.getItem('volc_appid');
    const volcAccessToken = localStorage.getItem('volc_access_token');

    let endpoint = '/api/transcribe-volc';
    let body = {};

    if (volcAppId && volcAccessToken) {
        body = {
            audioPath: memo.url,
            appId: volcAppId,
            accessToken: volcAccessToken
        };
    } else {
        alert('请先在“魔法管理”中配置豆包语音 API (AppID & Access Token)');
        return;
    }

    setTranscribingId(memo.id);
    try {
      console.log('Transcribing:', memo.id, endpoint, body);
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (!res.ok) {
          const errText = await res.text();
          console.error('Transcribe server error:', res.status, errText);
          throw new Error(`Server Error ${res.status}: ${errText}`);
      }

      const data = await res.json();
      
      if (data.success) {
        const updatedMemo = { ...memo, text: data.text };
        await saveMemoToServer(updatedMemo);
      } else {
        alert('转写失败: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      console.error('Transcribe fetch error:', e);
      alert('请求出错: ' + e.message);
    } finally {
      setTranscribingId(null);
    }
  };

  const handleMagicGenerate = async (memo) => {
    const apiKey = localStorage.getItem('deepseek_key');
    if (!apiKey) {
      alert('请先在“魔法管理”中配置 DeepSeek API Key');
      return;
    }
    
    if (!memo.text) {
      alert('请先进行语音转写');
      return;
    }

    setGeneratingId(memo.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/magic/generate-academic-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspirationContent: memo.text,
          associations: [], // No associations for now
          apiKey
        })
      });
      const data = await res.json();
      
      if (data.success) {
        const updatedMemo = { ...memo, academicText: data.result };
        await saveMemoToServer(updatedMemo);
      } else {
        alert('生成失败');
      }
    } catch (e) {
      alert('请求出错');
    } finally {
      setGeneratingId(null);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('确定删除这条语音留言吗？')) {
      try {
          await fetch(`${API_BASE_URL}/api/voice-memos/${id}`, { method: 'DELETE' });
          fetchMemos();
      } catch (e) {
          console.error('Failed to delete memo', e);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const scrollToMemo = (id) => {
    const element = document.getElementById(`memo-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar List */}
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <Mic className="w-5 h-5 text-red-500" />
            语音留言
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {savedMemos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              暂无留言，点击右侧录音
            </div>
          ) : (
            savedMemos.map(memo => (
              <div 
                key={memo.id} 
                className="p-4 border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => scrollToMemo(memo.id)}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-400">{new Date(memo.created_at).toLocaleString()}</span>
                  <span className="text-xs font-mono bg-slate-100 px-1 rounded text-slate-500">{formatTime(memo.duration)}</span>
                </div>
                <div className="text-sm text-slate-800 line-clamp-2">
                  {memo.text || '(未转写)'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-8 overflow-y-auto">
        {/* Recorder Section */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 mb-8 flex flex-col items-center justify-center min-h-[200px]">
          <div className="mb-6 text-4xl font-mono text-slate-700 font-bold">
            {formatTime(recordingTime)}
          </div>
          
          {!isRecording ? (
            <button 
              onClick={startRecording}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            >
              <Mic className="w-8 h-8" />
            </button>
          ) : (
            <button 
              onClick={stopRecording}
              className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-900 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105"
            >
              <Square className="w-6 h-6 fill-current" />
            </button>
          )}
          <p className="mt-4 text-slate-500 text-sm">
            {isRecording ? '正在录音...' : '点击开始录音'}
          </p>
        </div>

        {/* Memos List (Detailed) */}
        <div className="space-y-6">
          {savedMemos.map(memo => (
            <div 
                key={memo.id} 
                id={`memo-${memo.id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 scroll-mt-6"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                    <FileAudio className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-700">语音留言</div>
                    <div className="text-xs text-slate-400">{new Date(memo.created_at).toLocaleString()} • {formatTime(memo.duration)}</div>
                  </div>
                </div>
                <button onClick={() => handleDelete(memo.id)} className="text-slate-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Audio Player */}
              <audio src={`${API_BASE_URL}${memo.url}`} controls className="w-full mb-4" />

              {/* Actions */}
              <div className="flex gap-2 mb-4">
                <button 
                  onClick={() => handleTranscribe(memo)}
                  disabled={transcribingId === memo.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium disabled:opacity-50"
                >
                  {transcribingId === memo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {memo.text ? '重新转写' : '转写为文本'}
                </button>
                
                {memo.text && (
                  <button 
                    onClick={() => handleMagicGenerate(memo)}
                    disabled={generatingId === memo.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 text-sm font-medium disabled:opacity-50"
                  >
                    {generatingId === memo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    魔法生成学术文本
                  </button>
                )}
              </div>

              {/* Text Output */}
              {memo.text && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                  <h4 className="text-xs font-bold text-slate-500 mb-2 uppercase">转写文本</h4>
                  <p className="text-slate-700 whitespace-pre-wrap">{memo.text}</p>
                </div>
              )}

              {/* Academic Output */}
              {memo.academicText && (
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <h4 className="text-xs font-bold text-purple-500 mb-2 uppercase flex items-center gap-1">
                    <Wand2 className="w-3 h-3" /> 学术化文本
                  </h4>
                  <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{memo.academicText}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import { useSpotifyPlayer } from '../hooks/useSpotifyPlayer';
import { apiGet } from '../utils/api';

interface QuestionOption { id: string; label: string }

interface Question {
  id: string;
  type: string;
  prompt: string;
  options: QuestionOption[];
  spotifyUri?: string;
  previewUrl?: string;
}

interface PlayerScore { userId: string; displayName: string; score: number }

type Phase = 'waiting' | 'question' | 'reveal' | 'finished';

const TOTAL_TIME = 20;

function TimerRing({ timeLeft }: { timeLeft: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - timeLeft / TOTAL_TIME);
  const urgent = timeLeft <= 5;
  return (
    <div className="relative w-14 h-14 flex-shrink-0">
      <svg className="w-14 h-14" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="#333" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none"
          stroke={urgent ? 'var(--sp-error)' : 'var(--sp-green)'}
          strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold"
        style={{ color: urgent ? 'var(--sp-error)' : 'white' }}>
        {timeLeft}
      </span>
    </div>
  );
}

function AudioWave() {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[1, 2, 3, 4, 5].map((_, i) => (
        <div key={i} className="wave-bar" style={{ height: 20, animationDelay: `${i * 0.12}s` }} />
      ))}
    </div>
  );
}

function Podium({ scores, myUserId }: { scores: PlayerScore[]; myUserId: string }) {
  const top3 = scores.slice(0, 3);
  const rest = scores.slice(3);
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: 'var(--sp-black)' }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">Game Over!</h1>
        <p style={{ color: 'var(--sp-muted)' }} className="text-center text-sm mb-8">Final standings</p>

        {/* Top 3 podium */}
        <div className="flex items-end justify-center gap-4 mb-8">
          {/* 2nd */}
          {top3[1] && (
            <div className="text-center flex-1">
              <div className="text-2xl mb-1">🥈</div>
              <div className="rounded-t-xl pt-6 pb-4 px-2" style={{ background: 'var(--sp-card)' }}>
                <p className="text-xs font-semibold truncate">{top3[1].displayName}{top3[1].userId === myUserId ? ' (you)' : ''}</p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--sp-green)' }}>{top3[1].score}</p>
              </div>
            </div>
          )}
          {/* 1st */}
          {top3[0] && (
            <div className="text-center flex-1">
              <div className="text-3xl mb-1">🥇</div>
              <div className="rounded-t-xl pt-8 pb-4 px-2" style={{ background: '#1a3a27' }}>
                <p className="text-xs font-semibold truncate">{top3[0].displayName}{top3[0].userId === myUserId ? ' (you)' : ''}</p>
                <p className="text-xl font-bold mt-1" style={{ color: 'var(--sp-green)' }}>{top3[0].score}</p>
              </div>
            </div>
          )}
          {/* 3rd */}
          {top3[2] && (
            <div className="text-center flex-1">
              <div className="text-2xl mb-1">🥉</div>
              <div className="rounded-t-xl pt-4 pb-4 px-2" style={{ background: 'var(--sp-card)' }}>
                <p className="text-xs font-semibold truncate">{top3[2].displayName}{top3[2].userId === myUserId ? ' (you)' : ''}</p>
                <p className="text-lg font-bold mt-1" style={{ color: 'var(--sp-green)' }}>{top3[2].score}</p>
              </div>
            </div>
          )}
        </div>

        {/* Rest */}
        {rest.length > 0 && (
          <div className="card mb-6">
            {rest.map((s, i) => (
              <div key={s.userId} className="flex justify-between items-center py-2.5 border-b last:border-0"
                style={{ borderColor: 'var(--sp-border)' }}>
                <span className="text-sm">
                  <span style={{ color: 'var(--sp-muted)' }} className="mr-2">{i + 4}.</span>
                  {s.displayName}{s.userId === myUserId ? ' (you)' : ''}
                </span>
                <span className="font-bold text-sm">{medals[i + 3] ?? ''} {s.score} pts</span>
              </div>
            ))}
          </div>
        )}

        <a href="/join" className="btn-green w-full text-center block py-4">Play Again</a>
      </div>
    </div>
  );
}

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const myUserId = sessionStorage.getItem('spotify_user_id') ?? '';
  const sessionId = sessionStorage.getItem('session_id') ?? '';

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [correctAnswerId, setCorrectAnswerId] = useState<string | null>(null);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [myAnswerCorrect, setMyAnswerCorrect] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const startTimer = (limitMs: number) => {
    clearTimer();
    setTimeLeft(Math.ceil(limitMs / 1000));
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { clearTimer(); return 0; } return prev - 1; });
    }, 1000);
  };

  useEffect(() => () => clearTimer(), []);

  const getToken = useCallback(async () => {
    const { token } = await apiGet<{ token: string }>('/api/spotify/token', sessionId);
    return token;
  }, [sessionId]);

  const { play, stop, isPlaying } = useSpotifyPlayer(getToken);

  const handleMessage = useCallback((msg: { type: string; payload?: unknown }) => {
    switch (msg.type) {
      case 'question:new': {
        const p = msg.payload as {
          question: Question; questionIndex: number; totalQuestions: number; timeLimit: number;
        };
        setQuestion(p.question);
        setQuestionIndex(p.questionIndex);
        setTotalQuestions(p.totalQuestions);
        setSelectedAnswer(null);
        setCorrectAnswerId(null);
        setMyAnswerCorrect(null);
        setPhase('question');
        startTimer(p.timeLimit);

        // Playback for GUESS_THE_OWNER
        if (p.question.type === 'GUESS_THE_OWNER') {
          play(p.question.spotifyUri, p.question.previewUrl);
        }
        break;
      }
      case 'answer:ack': {
        const { correct } = msg.payload as { correct: boolean };
        setMyAnswerCorrect(correct);
        break;
      }
      case 'question:end': {
        const p = msg.payload as { correctAnswerId: string; scores: PlayerScore[] };
        clearTimer();
        setCorrectAnswerId(p.correctAnswerId);
        setScores(p.scores);
        setPhase('reveal');
        stop();
        break;
      }
      case 'game:ended': {
        const p = msg.payload as { scores: PlayerScore[] };
        clearTimer();
        setScores(p.scores);
        setPhase('finished');
        stop();
        break;
      }
      case 'error': {
        console.error('[game ws]', msg.payload);
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, stop, navigate]);

  const { send } = useWebSocket(code, handleMessage);

  function submitAnswer(answerId: string) {
    if (selectedAnswer || phase !== 'question') return;
    setSelectedAnswer(answerId);
    send('answer:submit', { answerId });
  }

  if (phase === 'finished') return <Podium scores={scores} myUserId={myUserId} />;

  if (phase === 'waiting') {
    return (
      <div className="page-center">
        <div className="spinner mx-auto mb-4" />
        <p className="font-semibold">Get ready!</p>
        <p style={{ color: 'var(--sp-muted)' }} className="text-sm mt-1">First question coming up...</p>
      </div>
    );
  }

  if (!question) return <div className="page-center"><div className="spinner" /></div>;

  const progress = (questionIndex / totalQuestions) * 100;

  return (
    <div className="min-h-screen px-4 py-6 flex flex-col" style={{ background: 'var(--sp-black)' }}>
      <div className="max-w-lg mx-auto w-full flex flex-col flex-1">

        {/* Progress bar + timer */}
        <div className="flex items-center gap-4 mb-5">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--sp-muted)' }}>
              <span>Question {questionIndex + 1}</span>
              <span>{totalQuestions}</span>
            </div>
            <div className="h-1 rounded-full" style={{ background: 'var(--sp-border)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: 'var(--sp-green)' }} />
            </div>
          </div>
          <TimerRing timeLeft={timeLeft} />
        </div>

        {/* Question card */}
        <div className="card mb-5 flex-1 flex flex-col justify-between" style={{ minHeight: 180 }}>
          <div>
            <span className="text-xs uppercase tracking-widest font-semibold px-2 py-1 rounded"
              style={{ background: 'rgba(29,185,84,0.15)', color: 'var(--sp-green)' }}>
              {question.type === 'GUESS_THE_OWNER' ? '🎵 Guess the Owner' : '🎤 Artist Match'}
            </span>
            <h2 className="text-xl font-bold mt-4 leading-snug">{question.prompt}</h2>
          </div>

          {/* Audio indicator */}
          {isPlaying && (
            <div className="flex items-center gap-2 mt-4">
              <AudioWave />
              <span style={{ color: 'var(--sp-muted)' }} className="text-xs">Now playing</span>
            </div>
          )}
        </div>

        {/* Answer grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {question.options.map(opt => {
            let cls = 'answer-btn';
            if (phase === 'reveal') {
              if (opt.id === correctAnswerId) cls += ' correct';
              else if (opt.id === selectedAnswer) cls += ' wrong';
              else cls += ' dimmed';
            } else if (opt.id === selectedAnswer) {
              cls += ' selected';
            }
            return (
              <button key={opt.id} className={cls}
                onClick={() => submitAnswer(opt.id)}
                disabled={!!selectedAnswer || phase === 'reveal'}>
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Answer feedback */}
        {myAnswerCorrect !== null && phase === 'question' && (
          <div className="text-center py-2">
            <span className="text-lg font-bold" style={{ color: myAnswerCorrect ? 'var(--sp-green)' : 'var(--sp-error)' }}>
              {myAnswerCorrect ? '✓ Correct!' : '✗ Wrong!'}
            </span>
          </div>
        )}

        {/* Scores during reveal */}
        {phase === 'reveal' && scores.length > 0 && (
          <div className="card mt-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--sp-muted)' }}>Scores</p>
            <div className="space-y-2">
              {scores.map((s, i) => (
                <div key={s.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm w-5 text-center" style={{ color: 'var(--sp-muted)' }}>{i + 1}</span>
                    <span className="text-sm font-medium truncate">
                      {s.displayName}{s.userId === myUserId ? ' (you)' : ''}
                    </span>
                  </div>
                  <span className="font-bold text-sm flex-shrink-0 ml-2" style={{ color: 'var(--sp-green)' }}>
                    {s.score} pts
                  </span>
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--sp-muted)' }} className="text-xs text-center mt-3">Next question in a moment...</p>
          </div>
        )}
      </div>
    </div>
  );
}

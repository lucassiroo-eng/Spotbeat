import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';

interface QuestionOption {
  id: string;
  label: string;
}

interface Question {
  id: string;
  type: string;
  prompt: string;
  options: QuestionOption[];
  spotifyUri?: string;
}

interface PlayerScore {
  userId: string;
  displayName: string;
  score: number;
}

type Phase = 'waiting' | 'question' | 'reveal' | 'finished';

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const myUserId = sessionStorage.getItem('spotify_user_id') ?? '';

  const [phase, setPhase] = useState<Phase>('waiting');
  const [question, setQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [correctAnswerId, setCorrectAnswerId] = useState<string | null>(null);
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [timeLeft, setTimeLeft] = useState(20);
  const [myAnswerCorrect, setMyAnswerCorrect] = useState<boolean | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startTimer = (limitMs: number) => {
    clearTimer();
    setTimeLeft(Math.ceil(limitMs / 1000));
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearTimer(), []);

  const handleMessage = useCallback((msg: { type: string; payload?: unknown }) => {
    switch (msg.type) {
      case 'question:new': {
        const p = msg.payload as {
          question: Question;
          questionIndex: number;
          totalQuestions: number;
          timeLimit: number;
        };
        setQuestion(p.question);
        setQuestionIndex(p.questionIndex);
        setTotalQuestions(p.totalQuestions);
        setSelectedAnswer(null);
        setCorrectAnswerId(null);
        setMyAnswerCorrect(null);
        setPhase('question');
        startTimer(p.timeLimit);
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
        break;
      }
      case 'game:ended': {
        const p = msg.payload as { scores: PlayerScore[] };
        clearTimer();
        setScores(p.scores);
        setPhase('finished');
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { send } = useWebSocket(code, handleMessage);

  function submitAnswer(answerId: string) {
    if (selectedAnswer || phase !== 'question') return;
    setSelectedAnswer(answerId);
    send('answer:submit', { answerId });
  }

  if (phase === 'finished') {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 600 }}>
        <h2>Game Over!</h2>
        <h3>Final Scores</h3>
        <ol style={{ padding: 0, listStyle: 'none' }}>
          {scores.map((s, i) => (
            <li key={s.userId} style={{ padding: '12px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 18 }}>
                {i + 1}. {s.displayName}{s.userId === myUserId ? ' (you)' : ''}
                {i === 0 ? ' 🏆' : ''}
              </span>
              <strong style={{ fontSize: 20 }}>{s.score} pts</strong>
            </li>
          ))}
        </ol>
        <button
          onClick={() => navigate('/join')}
          style={{ marginTop: 32, padding: '12px 28px', fontSize: 16, cursor: 'pointer', background: '#1DB954', color: '#fff', border: 'none', borderRadius: 6 }}
        >
          Play Again
        </button>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif', textAlign: 'center' }}>
        <h2>Get ready...</h2>
        <p style={{ color: '#888' }}>First question coming up!</p>
      </div>
    );
  }

  if (!question) return <div style={{ padding: 32 }}>Loading...</div>;

  return (
    <div style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 600 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ color: '#888', fontSize: 14 }}>
          Question {questionIndex + 1} / {totalQuestions}
        </span>
        <span style={{ fontWeight: 700, fontSize: 20, color: timeLeft <= 5 ? '#e74c3c' : '#333' }}>
          {timeLeft}s
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: '#eee', borderRadius: 2, marginBottom: 24 }}>
        <div style={{
          height: '100%', borderRadius: 2,
          background: timeLeft <= 5 ? '#e74c3c' : '#1DB954',
          width: `${(questionIndex / totalQuestions) * 100}%`,
          transition: 'width 0.3s',
        }} />
      </div>

      <h2 style={{ marginBottom: 24, lineHeight: 1.4 }}>{question.prompt}</h2>

      {/* Answer options */}
      <div style={{ display: 'grid', gap: 12 }}>
        {question.options.map(opt => {
          let bg = '#f0f0f0';
          let color = '#333';
          let border = '2px solid transparent';

          if (phase === 'reveal') {
            if (opt.id === correctAnswerId) { bg = '#1DB954'; color = '#fff'; }
            else if (opt.id === selectedAnswer) { bg = '#e74c3c'; color = '#fff'; }
          } else if (opt.id === selectedAnswer) {
            bg = '#e8f5e9'; border = '2px solid #1DB954';
          }

          return (
            <button
              key={opt.id}
              onClick={() => submitAnswer(opt.id)}
              disabled={!!selectedAnswer || phase === 'reveal'}
              style={{
                padding: '14px 20px', fontSize: 16, fontFamily: 'sans-serif',
                background: bg, color, border, borderRadius: 8,
                cursor: (selectedAnswer || phase === 'reveal') ? 'default' : 'pointer',
                textAlign: 'left', transition: 'background 0.2s, border 0.2s',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Per-answer feedback while still in question phase */}
      {myAnswerCorrect !== null && phase === 'question' && (
        <p style={{ marginTop: 16, fontWeight: 700, fontSize: 18, color: myAnswerCorrect ? '#1DB954' : '#e74c3c' }}>
          {myAnswerCorrect ? 'Correct!' : 'Wrong!'}
        </p>
      )}

      {/* Scores shown during reveal */}
      {phase === 'reveal' && scores.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <h3 style={{ marginBottom: 8 }}>Scores</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {scores.map(s => (
              <li key={s.userId} style={{ padding: '6px 0', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
                <span>{s.displayName}{s.userId === myUserId ? ' (you)' : ''}</span>
                <strong>{s.score} pts</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

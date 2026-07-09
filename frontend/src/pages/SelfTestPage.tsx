import React, { useEffect, useState } from 'react';
import { api, type SelfTestRun, type SelfTestScenarioResult } from '../api/api';
import { useUI } from '../components/ui';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

/**
 * SelfTestPage — Self-Test Mode (addendum v1.5).
 * Chạy loạt kịch bản headless kiểm tra tính năng cốt lõi END-TO-END trên backend,
 * hiển thị: tổng quan pass/fail, từng kịch bản (feature + element đã test), từng
 * assertion (expected vs actual), và curl sinh ra. Credential luôn đã mask.
 */
export function SelfTestPage() {
  const ui = useUI();
  const [run, setRun] = useState<SelfTestRun | null>(null);
  const [running, setRunning] = useState(false);

  const loadLast = async () => {
    try {
      const last = await api.get<SelfTestRun | null>('/selftest/results');
      if (last) setRun(last);
    } catch { /* chưa có kết quả */ }
  };
  useEffect(() => { loadLast(); /* eslint-disable-next-line */ }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const r = await api.post<SelfTestRun>('/selftest/run');
      setRun(r);
      ui.notify({
        kind: r.failed === 0 ? 'success' : 'error',
        title: r.failed === 0 ? 'Self-test PASS' : 'Self-test có lỗi',
        message: `${r.passed}/${r.total} kịch bản pass.`,
      });
    } catch (e: any) {
      ui.notify({ title: 'Lỗi', message: e.message, kind: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1 className="page-title">Self-Test Mode</h1>
        <span className="page-desc">Tự kiểm tra các tính năng cốt lõi (mã hóa, placeholder, extract, sandbox, CRUD…) chạy headless trên backend.</span>
      </div>

      <div className="toolbar">
        <Button variant="primary" icon={Icon.play({})} tooltip="Chạy toàn bộ kịch bản self-test ngay bây giờ" loading={running} onClick={runNow}>
          Chạy self-test
        </Button>
        {run && (
          <span className="page-desc" style={{ alignSelf: 'center' }}>
            Lần chạy gần nhất: {new Date(run.finishedAt).toLocaleString()} · {(run.finishedAt - run.startedAt)}ms
          </span>
        )}
      </div>

      {!run ? (
        <div className="empty">Chưa có kết quả. Bấm “Chạy self-test” để bắt đầu.</div>
      ) : (
        <>
          <div className="selftest-summary">
            <div className="selftest-stat">
              <div className="num">{run.total}</div>
              <div className="lbl">Tổng kịch bản</div>
            </div>
            <div className="selftest-stat ok">
              <div className="num">{run.passed}</div>
              <div className="lbl">Pass</div>
            </div>
            <div className={`selftest-stat${run.failed > 0 ? ' fail' : ''}`}>
              <div className="num">{run.failed}</div>
              <div className="lbl">Fail</div>
            </div>
          </div>

          {run.scenarios.map((s) => <ScenarioCard key={s.scenarioId} s={s} />)}
        </>
      )}
    </div>
  );
}

function ScenarioCard({ s }: { s: SelfTestScenarioResult }) {
  const [open, setOpen] = useState(s.result === 'fail');
  return (
    <div className="card" style={{ display: 'block', borderColor: s.result === 'fail' ? 'var(--danger)' : undefined }}>
      <div
        className="row"
        style={{ cursor: 'pointer', justifyContent: 'space-between' }}
        onClick={() => setOpen((v) => !v)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className={`badge ${s.result === 'pass' ? 'badge--success' : 'badge--danger'}`}>{s.result.toUpperCase()}</span>{' '}
          <b>{s.title}</b>
          <div className="page-desc" style={{ marginTop: 2 }}>{s.feature} · {s.elementText}</div>
        </div>
        <span className="badge">{s.assertions.filter((a) => a.pass).length}/{s.assertions.length}</span>
      </div>

      {open && (
        <div style={{ marginTop: 'var(--sp-2)' }}>
          <div className="assertion-list">
            {s.assertions.map((a, i) => (
              <div key={i} className={`assertion-row ${a.pass ? 'pass' : 'fail'}`}>
                <span className="mk">{a.pass ? Icon.check({ size: 14 }) : Icon.x({ size: 14 })}</span>
                <span style={{ flex: 1 }}>{a.name}</span>
                {!a.pass && (
                  <div className="diff-box">
                    expected: {JSON.stringify(a.expected)}{'\n'}actual:   {JSON.stringify(a.actual)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {Object.keys(s.captured).length > 0 && (
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <div className="page-desc">Giá trị capture:</div>
              <div className="diff-box">{JSON.stringify(s.captured, null, 2)}</div>
            </div>
          )}

          {s.builtCurl && (
            <div style={{ marginTop: 'var(--sp-2)' }}>
              <div className="page-desc">cURL sinh ra (credential đã mask):</div>
              <div className="diff-box">{s.builtCurl}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

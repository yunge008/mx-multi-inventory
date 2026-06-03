/**
 * 文件上传区 — 拖拽 + 点击，SheetJS 解析
 * Design: Precision Data Terminal
 */
import { useRef, useState, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { analyzeInventory } from '@/lib/analyzer';
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';

export default function UploadZone() {
  const { setFileName, setIsLoading, setLoadError, setResult, setActiveTab, resetAdjustedQty } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setLocalError('请上传 .xlsx 或 .xls 格式的 Excel 文件');
      return;
    }

    setLocalError(null);
    setLocalSuccess(false);
    setIsLoading(true);
    setFileName(file.name);
    setLoadError(null);
    resetAdjustedQty();

    try {
      const XLSX = (window as any).XLSX;
      if (!XLSX) throw new Error('SheetJS 未加载，请检查网络连接后刷新页面');

      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: false });

      const today = new Date();
      const result = analyzeInventory(wb, today);

      setResult(result);
      setLocalSuccess(true);
      setActiveTab('overview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '解析失败，请检查文件格式';
      setLoadError(msg);
      setLocalError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [setFileName, setIsLoading, setLoadError, setResult, setActiveTab, resetAdjustedQty]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-0 py-12">
      {/* 主上传区 */}
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''} flex flex-col items-center justify-center gap-4 cursor-pointer`}
        style={{ width: '480px', maxWidth: '90vw', padding: '48px 32px' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* 图标 */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'oklch(0.96 0.008 250)', border: '1px solid oklch(0.88 0.012 250)' }}
        >
          {localSuccess
            ? <CheckCircle2 size={32} style={{ color: 'oklch(0.52 0.16 145)' }} />
            : <Upload size={32} style={{ color: 'oklch(0.50 0.18 250)' }} />
          }
        </div>

        {/* 文字 */}
        <div className="text-center">
          <p style={{
            fontFamily: '"Outfit", sans-serif',
            fontWeight: 600,
            fontSize: '1.05rem',
            color: 'oklch(0.22 0.018 250)',
            marginBottom: '6px',
          }}>
            {localSuccess ? '文件已解析成功' : '上传 Excel 数据文件'}
          </p>
          <p style={{
            fontFamily: '"Noto Sans SC", sans-serif',
            fontSize: '0.82rem',
            color: 'oklch(0.52 0.012 250)',
          }}>
            {localSuccess
              ? '可重新拖拽文件以更新数据'
              : '拖拽文件至此处，或点击选择文件'
            }
          </p>
          <p style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.72rem',
            color: 'oklch(0.62 0.010 250)',
            marginTop: '4px',
          }}>
            支持 .xlsx / .xls 格式
          </p>
        </div>

        {/* 错误提示 */}
        {localError && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-md w-full"
            style={{ backgroundColor: 'oklch(0.96 0.025 25)', color: 'oklch(0.48 0.20 25)', fontSize: '0.80rem' }}
          >
            <AlertCircle size={14} />
            <span>{localError}</span>
          </div>
        )}
      </div>

      {/* 说明文字 */}
      <div className="mt-8" style={{ width: '480px', maxWidth: '90vw' }}>
        <p style={{
          fontFamily: '"Noto Sans SC", sans-serif',
          fontSize: '0.75rem',
          color: 'oklch(0.58 0.012 250)',
          textAlign: 'center',
          marginBottom: '12px',
          fontWeight: 600,
        }}>
          Excel 文件需包含以下 Sheet
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { name: '仙人掌海外仓库存', desc: '仓库可用库存', required: true },
            { name: 'MX-AR TTS商品表', desc: 'TTS 平台上架 SKU', required: true },
            { name: 'MX-AR TTS订单', desc: 'TTS 订单销量数据', required: true },
            { name: 'MX-AR美客多 商品表', desc: '美客多上架 SKU', required: true },
            { name: 'upseller流水', desc: '美客多订单销量', required: true },
            { name: 'MX-NE / MX-SJ', desc: '其他店铺（可选）', required: false },
          ].map(item => (
            <div
              key={item.name}
              className="flex items-start gap-2 px-3 py-2 rounded-md"
              style={{ backgroundColor: 'oklch(0.99 0.002 250)', border: '1px solid oklch(0.92 0.004 240)' }}
            >
              <FileSpreadsheet
                size={13}
                style={{ color: item.required ? 'oklch(0.50 0.16 145)' : 'oklch(0.60 0.012 250)', marginTop: '2px', flexShrink: 0 }}
              />
              <div>
                <p style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.68rem', color: 'oklch(0.30 0.018 250)', fontWeight: 500 }}>
                  {item.name}
                </p>
                <p style={{ fontFamily: '"Noto Sans SC", sans-serif', fontSize: '0.68rem', color: 'oklch(0.55 0.012 250)' }}>
                  {item.desc}
                  {!item.required && <span style={{ color: 'oklch(0.62 0.010 250)' }}> · 可选</span>}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

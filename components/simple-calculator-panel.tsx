"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Copy, Delete, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CalculatorHistory {
  id: string;
  time: string;
  formula: string;
  result: string;
}

const HISTORY_KEY = "skupy-basic-calculator-history";

export function SimpleCalculatorPanel() {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [formulaLabel, setFormulaLabel] = useState("");
  const [history, setHistory] = useState<CalculatorHistory[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // History is helpful, but the calculator should keep working without storage.
    }
  }, [history]);

  const currentValue = useMemo(() => parseDisplay(display), [display]);

  function inputDigit(digit: string) {
    setMessage("");
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }
    setDisplay((current) => (current === "0" ? digit : `${current}${digit}`));
  }

  function inputDecimal() {
    setMessage("");
    if (waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay(`${display}.`);
  }

  function clearAll() {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setFormulaLabel("");
    setMessage("");
  }

  function backspace() {
    setMessage("");
    if (waitingForOperand) return;
    setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
  }

  function percent() {
    setMessage("");
    setDisplay(formatCalculatorNumber(currentValue / 100));
  }

  function chooseOperator(nextOperator: string) {
    setMessage("");

    if (operator && storedValue !== null && !waitingForOperand) {
      const result = calculate(storedValue, currentValue, operator);
      setStoredValue(result);
      setDisplay(formatCalculatorNumber(result));
      setFormulaLabel(`${formatCalculatorNumber(result)} ${nextOperator}`);
    } else {
      setStoredValue(currentValue);
      setFormulaLabel(`${display} ${nextOperator}`);
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
  }

  function equals() {
    if (!operator || storedValue === null) return;

    const result = calculate(storedValue, currentValue, operator);
    const left = formatCalculatorNumber(storedValue);
    const right = formatCalculatorNumber(currentValue);
    const resultText = formatCalculatorNumber(result);
    const formula = `${left} ${operator} ${right}`;

    setDisplay(resultText);
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
    setFormulaLabel(`${formula} =`);
    setHistory((items) => [
      {
        id: `${Date.now()}`,
        time: new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
        formula,
        result: resultText
      },
      ...items
    ].slice(0, 30));
  }

  async function copyResult() {
    setMessage("");
    try {
      await navigator.clipboard.writeText(display);
      setMessage("Hasil berhasil disalin.");
    } catch {
      setMessage("Browser tidak mengizinkan salin otomatis.");
    }
  }

  function clearHistory() {
    setHistory([]);
    setMessage("History berhasil dihapus.");
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-ink">Kalkulator</h1>
        <p className="mt-2 text-sm text-muted">Kalkulator cepat untuk kebutuhan produksi dan estimasi biaya.</p>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Kalkulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border border-line bg-black p-4 text-right">
              <p className="min-h-5 truncate text-sm text-muted">{formulaLabel || " "}</p>
              <p className="mt-2 min-h-12 break-all text-4xl font-black text-ink">{formatDisplay(display)}</p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <CalcButton tone="utility" onClick={clearAll}>C</CalcButton>
              <CalcButton tone="utility" onClick={percent}>%</CalcButton>
              <CalcButton tone="utility" onClick={backspace} ariaLabel="Hapus 1 digit">
                <Delete className="h-5 w-5" aria-hidden />
              </CalcButton>
              <CalcButton tone="operator" onClick={() => chooseOperator("÷")}>÷</CalcButton>

              <CalcButton onClick={() => inputDigit("7")}>7</CalcButton>
              <CalcButton onClick={() => inputDigit("8")}>8</CalcButton>
              <CalcButton onClick={() => inputDigit("9")}>9</CalcButton>
              <CalcButton tone="operator" onClick={() => chooseOperator("×")}>×</CalcButton>

              <CalcButton onClick={() => inputDigit("4")}>4</CalcButton>
              <CalcButton onClick={() => inputDigit("5")}>5</CalcButton>
              <CalcButton onClick={() => inputDigit("6")}>6</CalcButton>
              <CalcButton tone="operator" onClick={() => chooseOperator("-")}>-</CalcButton>

              <CalcButton onClick={() => inputDigit("1")}>1</CalcButton>
              <CalcButton onClick={() => inputDigit("2")}>2</CalcButton>
              <CalcButton onClick={() => inputDigit("3")}>3</CalcButton>
              <CalcButton tone="operator" onClick={() => chooseOperator("+")}>+</CalcButton>

              <CalcButton className="col-span-2" onClick={() => inputDigit("0")}>0</CalcButton>
              <CalcButton onClick={inputDecimal}>.</CalcButton>
              <CalcButton tone="equals" onClick={equals}>=</CalcButton>
            </div>

            {message ? <p className="border border-line bg-canvas p-3 text-sm text-muted">{message}</p> : null}

            <Button type="button" className="w-full" onClick={copyResult}>
              <Copy className="h-4 w-4" aria-hidden />
              Salin Hasil
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>History Perhitungan</CardTitle>
                <p className="mt-1 text-sm text-muted">Tersimpan otomatis di browser.</p>
              </div>
              <Button variant="secondary" size="sm" type="button" onClick={clearHistory} disabled={history.length === 0}>
                <Trash2 className="h-4 w-4" aria-hidden />
                Hapus History
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <div className="border border-dashed border-line bg-canvas p-5 text-sm text-muted">Belum ada history.</div>
            ) : (
              <div className="grid gap-3">
                {history.map((item) => (
                  <div key={item.id} className="border border-line bg-canvas p-4">
                    <p className="text-xs font-semibold text-accent">{item.time}</p>
                    <p className="mt-2 text-base font-bold text-ink">
                      {item.formula} = {item.result}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CalcButton({
  children,
  onClick,
  tone = "number",
  className,
  ariaLabel
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "number" | "operator" | "utility" | "equals";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "flex h-14 items-center justify-center border text-xl font-black transition active:scale-[0.98]",
        tone === "number" && "border-line bg-[#17191d] text-ink hover:border-accent/50",
        tone === "utility" && "border-line bg-[#22252a] text-muted hover:text-ink",
        tone === "operator" && "border-accent bg-accent text-white hover:brightness-110",
        tone === "equals" && "border-[#FFD700] bg-[#FFD700] text-black hover:brightness-110",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function calculate(left: number, right: number, operator: string) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "×") return left * right;
  if (operator === "÷") return right === 0 ? 0 : left / right;
  return right;
}

function parseDisplay(value: string) {
  return Number(value) || 0;
}

function formatCalculatorNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return String(rounded);
}

function formatDisplay(value: string) {
  const [integerPart, decimalPart] = value.split(".");
  const integer = new Intl.NumberFormat("id-ID").format(Number(integerPart || 0));
  if (value.endsWith(".")) return `${integer}.`;
  if (decimalPart !== undefined) return `${integer}.${decimalPart}`;
  return integer;
}

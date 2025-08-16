// ===================== Helpers (pt-BR) =====================
function parseBRNumber(input) {
    // Aceita "40.000,50", "40000,50", "40000.50" e "40000"
    if (input == null) return NaN;
    const raw = String(input).trim().replace(/\s+/g, "");
    if (!raw) return NaN;
    // remove % e qualquer caractere não numérico de milhar/decimal
    const cleaned = raw.replace(/%/g, "").replace(/[^\d.,-]/g, "");
    // último separador decimal válido (vírgula ou ponto)
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    let normalized;
    if (lastComma > lastDot) {
        // decimal é vírgula -> remove todos os pontos (milhar) e troca vírgula por ponto
        normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
        // decimal é ponto (ou não há vírgula) -> remove todas as vírgulas (milhar)
        normalized = cleaned.replace(/,/g, "");
    }
    return Number(normalized);
}

function fmtBRL(n) {
    return (Number(n) || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });
}

// ===================== Seletores =====================
const form = document.getElementById("loanForm");
const resultsSection = document.getElementById("results");
const monthlyPaymentEl = document.getElementById("monthlyPayment");
const totalPaymentEl = document.getElementById("totalPayment");
const totalInterestEl = document.getElementById("totalInterest");
const tableBody = document.querySelector("#amortizationTable tbody");
const chartCtx = document.getElementById("loanChart").getContext("2d");
let loanChart = null;

// ===================== Lógica =====================
form.addEventListener("submit", (e) => {
    e.preventDefault();

    const amount = parseBRNumber(document.getElementById("amount").value);     // R$
    const months = Math.trunc(parseBRNumber(document.getElementById("months").value)); // meses
    const interestPct = parseBRNumber(document.getElementById("interest").value);      // % ao mês

    // Validações
    if (!isFinite(amount) || amount <= 0 ||
        !Number.isInteger(months) || months <= 0 ||
        !isFinite(interestPct) || interestPct < 0) {
        alert("Preencha todos os campos corretamente (valor > 0, meses > 0 e juros ≥ 0).");
        return;
    }

    const i = interestPct / 100; // taxa mensal em decimal
    // Prestação (Price) com tratamento para i = 0
    let pmt;
    if (i === 0) {
        pmt = amount / months;
    } else {
        const fator = Math.pow(1 + i, months);
        pmt = amount * (i * fator) / (fator - 1);
    }

    // Monta a tabela de amortização
    let saldo = amount;
    let totalJuros = 0;
    const linhas = [];

    for (let mes = 1; mes <= months; mes++) {
        let jurosMes = saldo * i;
        let amortizacao = (i === 0) ? pmt : (pmt - jurosMes);

        // Ajuste no último mês para zerar o saldo (erros de arredondamento)
        if (mes === months) {
            amortizacao = saldo;                 // quita o saldo restante
            jurosMes = i === 0 ? 0 : saldo * i;  // juros do último mês pelo saldo antes de quitar
            pmt = amortizacao + jurosMes;
            saldo = 0;
        } else {
            saldo -= amortizacao;
            if (Math.abs(saldo) < 0.005) saldo = 0; // evita -0
        }

        totalJuros += jurosMes;

        linhas.push({
            mes,
            parcela: pmt,
            amort: amortizacao,
            juros: jurosMes,
            saldo: Math.max(saldo, 0)
        });
    }

    const totalPago = linhas.reduce((acc, l) => acc + l.parcela, 0);

    // Exibe resultados
    resultsSection.classList.remove("hidden");
    monthlyPaymentEl.textContent = `Parcela mensal: ${fmtBRL(linhas[0].parcela)}`;
    totalPaymentEl.textContent = `Valor total pago: ${fmtBRL(totalPago)}`;
    totalInterestEl.textContent = `Total de juros pagos: ${fmtBRL(totalJuros)}`;

    // Preenche tabela
    tableBody.innerHTML = linhas.map(l => `
    <tr>
      <td>${l.mes}</td>
      <td>${fmtBRL(l.parcela)}</td>
      <td>${fmtBRL(l.amort)}</td>
      <td>${fmtBRL(l.juros)}</td>
      <td>${fmtBRL(l.saldo)}</td>
    </tr>
  `).join("");

    // Dados do gráfico (2 casas decimais como número)
    const labels = linhas.map(l => l.mes);
    const saldoData = linhas.map(l => Number(l.saldo.toFixed(2)));
    const amortData = linhas.map(l => Number(l.amort.toFixed(2)));
    const jurosData = linhas.map(l => Number(l.juros.toFixed(2)));

    // Gráfico
    if (loanChart) loanChart.destroy();
    loanChart = new Chart(chartCtx, {
        type: "line",
        data: {
            labels,
            datasets: [
                { label: "Saldo Devedor", data: saldoData, borderColor: "#004080", borderWidth: 2, pointRadius: 2, fill: false },
                { label: "Amortização", data: amortData, borderColor: "#2e7d32", borderWidth: 2, pointRadius: 2, fill: false },
                { label: "Juros", data: jurosData, borderColor: "#c62828", borderWidth: 2, pointRadius: 2, fill: false },
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: "bottom" } },
            scales: {
                y: {
                    ticks: {
                        callback: (value) => fmtBRL(value)
                    }
                }
            }
        }
    });
});

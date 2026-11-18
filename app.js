/* Sorteio GTA 6 — Nauã Pietro
   Lê sorteio.json da mesma pasta (com cache-buster) e recarrega a cada 60 s.
   Todo texto vindo do JSON entra com textContent (nunca como HTML). */
(function () {
  "use strict";

  var ARQUIVO = "sorteio.json";
  var INTERVALO = 60 * 1000;
  var PLATAFORMAS = {
    tiktok: "TikTok",
    youtube: "YouTube",
    kick: "Kick",
    instagram: "Instagram",
  };

  var $ = function (id) {
    return document.getElementById(id);
  };
  var dados = null;
  var carregouUmaVez = false;
  var mostrarTodos = false;
  var LIMITE = 12; // no começo mostra só os primeiros; a busca sempre olha a lista toda

  function semAcento(txt) {
    return String(txt || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  function dataBR(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
  }

  function milhar(n) {
    return Number(n).toLocaleString("pt-BR");
  }

  function el(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto != null) e.textContent = texto;
    return e;
  }

  function lista(v) {
    return Array.isArray(v) ? v : [];
  }

  /* ---------- Topo e meta ---------- */
  function renderTopo(d) {
    var ciclo = d.ciclo || {};
    // depois do sorteio, o topo mostra o prêmio que valeu (GTA 6 ou gift card)
    document.querySelector('[data-campo="premio"]').textContent =
      premioFinal(d);
    if (ciclo.fim)
      document.querySelector('[data-campo="data-sorteio"]').textContent =
        dataBR(ciclo.fim).slice(0, 5); // só dia/mês: "31/12"
  }

  function renderMeta(d) {
    var pct = Number(d.meta && d.meta.pct);
    if (!isFinite(pct)) pct = 0;
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    $("meta-valor").textContent = pct;
    var barra = $("meta-barra");
    barra.setAttribute("aria-valuenow", pct);
    barra.setAttribute("aria-valuetext", pct + "% da meta");
    var preenchido = $("meta-preenchido");
    // espera um quadro na primeira vez para a barra crescer suave
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        preenchido.style.setProperty("--meta", pct / 100);
      });
    });
  }

  /* ---------- Top apoiadores ---------- */
  function renderTop(d) {
    var ol = $("top-lista");
    var itens = lista(d.ranking)
      .slice()
      .sort(function (a, b) {
        return (a.pos || 0) - (b.pos || 0);
      })
      .slice(0, 10);
    ol.replaceChildren();
    itens.forEach(function (r) {
      var li = el(
        "li",
        "top-item" + (r.pos === 1 ? " primeiro" : r.pos <= 3 ? " podio" : ""),
      );
      var pos = el("span", "top-pos", r.pos + "º");
      pos.setAttribute("aria-label", r.pos + "º lugar");
      li.append(pos, el("span", "top-nome", r.nome || "—"));
      ol.append(li);
    });
    $("top-vazio").hidden = itens.length > 0;
  }

  /* ---------- Participantes ---------- */
  function renderResumo(d) {
    var pessoas = lista(d.participantes).length;
    var total = Number(d.totalNumeros) || 0;
    var r = $("part-resumo");
    r.replaceChildren();
    r.append(
      el("strong", null, milhar(pessoas)),
      pessoas === 1 ? " pessoa · " : " pessoas · ",
      el("strong", null, milhar(total)),
      total === 1 ? " número entregue" : " números entregues",
    );
  }

  function renderLista() {
    if (!dados) return;
    var termo = semAcento($("busca-campo").value);
    var soNumero = /^\d+$/.test(termo) ? Number(termo) : null;
    var vencedorNome =
      dados.sorteio && dados.sorteio.vencedor
        ? semAcento(dados.sorteio.vencedor)
        : null;

    var todos = lista(dados.participantes)
      .slice()
      .sort(function (a, b) {
        return (lista(a.numeros)[0] || 0) - (lista(b.numeros)[0] || 0);
      });

    var achados = todos.filter(function (p) {
      if (!termo) return true;
      if (soNumero !== null && lista(p.numeros).indexOf(soNumero) !== -1)
        return true;
      return semAcento(p.nome).indexOf(termo) !== -1;
    });

    var cortar = !termo && !mostrarTodos && achados.length > LIMITE;
    var visiveis = cortar ? achados.slice(0, LIMITE) : achados;
    var botao = $("ver-todos");
    botao.hidden = !cortar;
    if (cortar)
      botao.textContent = "Ver todos os " + achados.length + " participantes";

    var ul = $("lista");
    var frag = document.createDocumentFragment();
    visiveis.forEach(function (p) {
      var li = el("li", "pessoa");
      if (vencedorNome && semAcento(p.nome) === vencedorNome)
        li.classList.add("vencedora");
      li.append(el("span", "pessoa-nome", p.nome || "—"));
      var chave = String(p.plataforma || "").toLowerCase();
      var plat = el(
        "span",
        "pessoa-plat",
        PLATAFORMAS[chave] || p.plataforma || "",
      );
      plat.dataset.plat = chave;
      li.append(plat);

      var nums = el("ul", "nums");
      nums.setAttribute("aria-label", "Números");
      lista(p.numeros).forEach(function (n) {
        var chip = el("li", "num-chip" + (soNumero === n ? " achado" : ""));
        chip.append(
          el("small", null, "Nº"),
          document.createTextNode(String(n)),
        );
        nums.append(chip);
      });
      li.append(nums);
      frag.append(li);
    });
    ul.replaceChildren(frag);

    var vazio = $("lista-vazia");
    var aviso = $("busca-resultado");
    if (!todos.length) {
      vazio.hidden = false;
      vazio.textContent =
        "Ninguém entrou ainda. Digite !sorteio na live e seja o primeiro!";
      aviso.textContent = "";
    } else if (termo && !achados.length) {
      vazio.hidden = false;
      vazio.textContent =
        "Não achamos “" +
        $("busca-campo").value.trim() +
        "”. Escreva igual ao seu nome na live. Ainda não tem número? Digite !sorteio na live.";
      aviso.textContent = "Nenhum resultado.";
    } else {
      vazio.hidden = true;
      aviso.textContent = termo
        ? achados.length === 1
          ? "1 participante encontrado."
          : achados.length + " participantes encontrados."
        : "";
    }
  }

  /* ---------- Resultado ---------- */
  function premioFinal(d) {
    var ciclo = d.ciclo || {};
    if (d.sorteio && d.sorteio.reserva === true) {
      return ciclo.premioReserva || "Gift card R$ 100";
    }
    return ciclo.premio || "GTA 6 lacrado (PS5)";
  }

  function renderResultado(d) {
    var s = d.sorteio;
    var secao = $("resultado");
    if (!s) {
      secao.hidden = true;
      return;
    }
    secao.hidden = false;

    var fonte = s.fonte ? s.fonte : "Mega da Virada";
    $("resultado-fonte").textContent =
      fonte + (s.data ? " · " + dataBR(s.data) : "");

    var dezenas = lista(s.dezenas)
      .map(Number)
      .filter(function (n) {
        return isFinite(n);
      })
      .sort(function (a, b) {
        return a - b;
      });
    var ol = $("resultado-dezenas");
    ol.replaceChildren();
    dezenas.forEach(function (n) {
      ol.append(el("li", null, String(n).padStart(2, "0")));
    });

    var total = Number(d.totalNumeros) || 0;
    var conta = $("resultado-conta");
    conta.replaceChildren();
    var calculado = null;
    if (dezenas.length && total > 0 && typeof BigInt === "function") {
      var junto = dezenas
        .map(function (n) {
          return String(n).padStart(2, "0");
        })
        .join("");
      var resto = BigInt(junto) % BigInt(total);
      calculado = Number(resto) + 1;
      conta.append(
        el("b", null, junto),
        " ÷ ",
        el("b", null, milhar(total)),
        " números = resto ",
        el("b", null, String(resto)),
        document.createElement("br"),
        String(resto) + " + 1 = ",
        el("b", null, "Nº " + calculado),
      );
    } else {
      conta.textContent = "A conta aparece quando as dezenas forem publicadas.";
    }

    var vencedorNum =
      s.numeroVencedor != null ? Number(s.numeroVencedor) : calculado;
    $("resultado-numero").textContent =
      vencedorNum != null ? "Nº " + vencedorNum : "—";
    $("resultado-vencedor").textContent = s.vencedor || "A confirmar";
    // "reserva": true = a meta não bateu, o prêmio vira o gift card
    $("resultado-premio").textContent = premioFinal(d);

    var status = $("resultado-status");
    if (s.conferido) {
      status.textContent = "Conferido";
      status.className = "selo ok";
    } else {
      status.textContent = "Aguardando conferência";
      status.className = "selo";
    }

    var nota = $("resultado-nota");
    if (calculado != null && vencedorNum != null && calculado !== vencedorNum) {
      nota.hidden = false;
      nota.textContent =
        "A conta deu Nº " +
        calculado +
        ", mas o dono não seguiu as 4 redes ou não respondeu em 7 dias. Então valeu o próximo: Nº " +
        vencedorNum +
        ".";
    } else {
      nota.hidden = true;
    }
  }

  /* ---------- Rodapé ---------- */
  function renderAtualizado(d) {
    var alvo = $("atualizado");
    var quando = d.atualizado ? new Date(d.atualizado) : null;
    if (!quando || isNaN(quando.getTime())) {
      alvo.textContent = "";
      return;
    }
    try {
      var fmt = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      alvo.textContent =
        "Dados atualizados em " +
        fmt.format(quando).replace(",", " às") +
        " (horário de Brasília).";
    } catch (e) {
      alvo.textContent =
        "Dados atualizados em " + quando.toLocaleString("pt-BR") + ".";
    }
  }

  function render(d) {
    dados = d;
    renderTopo(d);
    renderMeta(d);
    renderTop(d);
    renderResumo(d);
    renderLista();
    renderResultado(d);
    renderAtualizado(d);
  }

  function avisar(msg) {
    var a = $("aviso");
    a.textContent = msg || "";
    a.hidden = !msg;
  }

  function carregar() {
    return fetch(ARQUIVO + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        render(d);
        carregouUmaVez = true;
        avisar("");
      })
      .catch(function () {
        if (carregouUmaVez) {
          avisar("Não deu para atualizar agora. Tentando de novo em 1 minuto.");
        } else {
          avisar(
            "Não deu para carregar a lista. Confira sua internet; tentando de novo em 1 minuto.",
          );
          $("atualizado").textContent = "";
        }
      });
  }

  $("busca-campo").addEventListener("input", renderLista);
  $("ver-todos").addEventListener("click", function () {
    mostrarTodos = true;
    var primeiroNovo = LIMITE;
    renderLista();
    var alvo = $("lista").children[primeiroNovo];
    if (alvo) {
      alvo.setAttribute("tabindex", "-1");
      alvo.focus({ preventScroll: true });
    }
  });

  carregar();
  setInterval(function () {
    if (!document.hidden) carregar();
  }, INTERVALO);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) carregar();
  });
})();

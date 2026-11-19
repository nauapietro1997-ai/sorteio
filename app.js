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
  var ICONES = {
    tiktok: { src: "assets/icones/tiktok.svg", branco: true },
    instagram: { src: "assets/icones/instagram.svg", branco: true },
    youtube: { src: "assets/icones/youtube.svg" },
    kick: { src: "assets/icones/kick.png" },
  };
  var reduzido =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var inicioCascata = 0; // no "ver todos", só os novos entram em cascata
  var ultimoTexto = null; // JSON da última vez (se não mudou, não redesenha)
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

  var metaAtual = 0; // valor que está aparecendo na tela agora
  var contagem = null;

  // número sobe de "de" até "ate" junto com a barra (mesma curva de saída suave)
  function contar(de, ate, ms) {
    var alvo = $("meta-valor");
    if (contagem) cancelAnimationFrame(contagem);
    if (reduzido || de === ate) {
      alvo.textContent = ate;
      return;
    }
    var inicio = null;
    function passo(t) {
      if (inicio === null) inicio = t;
      var p = Math.min(1, (t - inicio) / ms);
      var suave = 1 - Math.pow(1 - p, 4);
      alvo.textContent = Math.round(de + (ate - de) * suave);
      if (p < 1) contagem = requestAnimationFrame(passo);
    }
    contagem = requestAnimationFrame(passo);
  }

  function renderMeta(d, primeira) {
    var pct = Number(d.meta && d.meta.pct);
    if (!isFinite(pct)) pct = 0;
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    var barra = $("meta-barra");
    barra.setAttribute("aria-valuenow", pct);
    barra.setAttribute("aria-valuetext", pct + "% da meta");
    var preenchido = $("meta-preenchido");
    var de = metaAtual;
    metaAtual = pct;
    // na primeira vez espera a barra abrir na tela; depois anima direto
    setTimeout(
      function () {
        // transform direto no elemento (sem variável CSS herdada)
        preenchido.style.transform = "scaleX(" + pct / 100 + ")";
        contar(de, pct, 1600);
        $("meta-secao").classList.toggle("feito", pct >= 100);
      },
      primeira && !reduzido ? 750 : 0,
    );
  }

  /* ---------- Top apoiadores ---------- */
  // prêmios garantidos do Top 3 (se o servidor não mandar, valem estes)
  var PREMIOS_TOP = [
    "Gift card R$ 100 + pacote Lenda",
    "Cargo VIP no Discord + destaque na live",
    "Cargo VIP no Discord + destaque na live",
  ];
  var MINIMO_TOP = [5000, 0, 0];

  function premiosTop(d) {
    var ciclo = d.ciclo || {};
    var p = lista(ciclo.premiosTop);
    var m = lista(ciclo.minimoTop);
    return [0, 1, 2].map(function (i) {
      var min = Number(m[i] != null ? m[i] : MINIMO_TOP[i]);
      return {
        premio: p[i] ? String(p[i]) : PREMIOS_TOP[i],
        minimo: isFinite(min) && min > 0 ? min : 0,
      };
    });
  }

  function textoMinimo(min) {
    return "mín. " + milhar(min) + " moedas no ciclo";
  }

  function renderRegTop(d) {
    var ul = $("reg-top");
    if (!ul) return;
    ul.replaceChildren();
    premiosTop(d).forEach(function (p, i) {
      ul.append(
        el(
          "li",
          null,
          i +
            1 +
            "º: " +
            p.premio +
            (p.minimo ? " (" + textoMinimo(p.minimo) + ")" : ""),
        ),
      );
    });
  }

  function renderTop(d, animar) {
    var ol = $("top-lista");
    var premios = premiosTop(d);
    var itens = lista(d.ranking)
      .slice()
      .sort(function (a, b) {
        return (a.pos || 0) - (b.pos || 0);
      })
      .slice(0, 10);
    // o pódio sempre aparece (com o prêmio), mesmo antes de ter nomes
    [1, 2, 3].forEach(function (pos) {
      var tem = itens.some(function (r) {
        return r.pos === pos;
      });
      if (!tem) itens.push({ pos: pos, nome: null });
    });
    itens.sort(function (a, b) {
      return (a.pos || 0) - (b.pos || 0);
    });
    ol.replaceChildren();
    var temNome = false;
    itens.forEach(function (r, i) {
      var li = el(
        "li",
        "top-item" + (r.pos === 1 ? " primeiro" : r.pos <= 3 ? " podio" : ""),
      );
      if (animar) {
        li.classList.add("entra");
        li.style.setProperty("--i", i);
      }
      var pos = el("span", "top-pos", r.pos + "º");
      pos.setAttribute("aria-label", r.pos + "º lugar");
      li.append(pos);
      if (r.pos >= 1 && r.pos <= 3) {
        // medalhas geradas do overlay (ico-medalha-1/2/3)
        var med = el("img", "top-medalha");
        med.src = "assets/ico-medalha-" + r.pos + ".webp";
        med.alt = "";
        med.width = 112;
        med.height = 112;
        li.append(med);
      }
      if (r.nome) temNome = true;
      var nome = el("span", "top-nome", r.nome || "Vaga aberta");
      if (!r.nome) nome.classList.add("vago");
      if (r.pos >= 1 && r.pos <= 3) {
        var info = el("span", "top-info");
        var pr = premios[r.pos - 1];
        info.append(nome, el("span", "top-premio", pr.premio));
        if (pr.minimo)
          info.append(el("small", "top-min", textoMinimo(pr.minimo)));
        li.append(info);
      } else {
        li.append(nome);
      }
      ol.append(li);
    });
    $("top-vazio").hidden = temNome;
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

  // modo: "cascata" (primeira vez / ver todos), "rapido" (busca) ou nada (atualização)
  function renderLista(modo) {
    if (!dados) return;
    if (typeof modo !== "string") modo = "";
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
    visiveis.forEach(function (p, i) {
      var li = el("li", "pessoa");
      if (vencedorNome && semAcento(p.nome) === vencedorNome)
        li.classList.add("vencedora");
      if (modo === "cascata" && i >= inicioCascata) {
        li.classList.add("entra");
        li.style.setProperty("--i", Math.min(i - inicioCascata, 12));
      } else if (modo === "rapido") {
        li.classList.add("entra-rapido");
      }
      var quem = el("span", "pessoa-quem");
      quem.append(el("span", "pessoa-nome", p.nome || "—"));
      if (p.apoiador === true) {
        // selo brilhante de quem apoiou a live (campo opcional do JSON)
        var selo = el("span", "selo-apoiador");
        var presente = el("img");
        presente.src = "assets/ico-presente.webp";
        presente.alt = "";
        presente.width = 16;
        presente.height = 16;
        selo.append(
          el("span", "selo-brilho"),
          presente,
          el("span", null, "Apoiador"),
        );
        quem.append(selo);
      }
      if (p.completo === true) {
        // fez os 3 jeitos e dobrou os números (campo opcional do JSON)
        var completo = el("span", "selo-completo", "Completo");
        completo.title = "Fez os 3 jeitos e dobrou os números";
        quem.append(completo);
      }
      li.append(quem);
      var chave = String(p.plataforma || "").toLowerCase();
      var plat = el("span", "pessoa-plat");
      plat.dataset.plat = chave;
      if (ICONES[chave]) {
        // ícone oficial da rede
        var ico = el("img", ICONES[chave].branco ? "branco" : "");
        ico.src = ICONES[chave].src;
        ico.alt = "";
        ico.width = 14;
        ico.height = 14;
        plat.append(ico);
      }
      plat.append(PLATAFORMAS[chave] || p.plataforma || "");
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
      // quantos números vieram de presente (campo opcional "pagos"): texto discreto
      var pagos = Math.floor(Number(p.pagos));
      if (isFinite(pagos) && pagos > 0)
        li.append(el("span", "pessoa-pagos", "+" + pagos + " por presente"));
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
    var primeira = !dados; // só a primeira carga tem animação de entrada nas listas
    dados = d;
    renderTopo(d);
    renderMeta(d, primeira);
    renderTop(d, primeira);
    renderRegTop(d);
    renderResumo(d);
    inicioCascata = 0;
    renderLista(primeira ? "cascata" : "");
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
        return r.text();
      })
      .then(function (texto) {
        // nada mudou desde o último minuto: não mexe na tela
        if (texto !== ultimoTexto) {
          var d = JSON.parse(texto);
          render(d);
          ultimoTexto = texto;
        }
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

  /* ---------- Movimento: painéis aparecem ao rolar ---------- */
  function ligarRevelar() {
    var alvos = document.querySelectorAll(".revela");
    if (!("IntersectionObserver" in window)) {
      alvos.forEach(function (a) {
        a.classList.add("visto");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (entradas) {
        entradas.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("visto");
            io.unobserve(e.target); // aparece uma vez só
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
    );
    alvos.forEach(function (a) {
      io.observe(a);
    });
  }

  /* ---------- Movimento: capa do topo anda mais devagar que a página ---------- */
  function ligarParallax() {
    var par = $("capa-par");
    var topo = document.querySelector(".topo");
    if (!par || !topo || reduzido) return;
    var pedido = false;
    function mover() {
      pedido = false;
      var y = window.scrollY;
      if (y > topo.offsetHeight) return;
      par.style.transform = "translate3d(0," + Math.round(y * 0.3) + "px,0)";
    }
    window.addEventListener(
      "scroll",
      function () {
        if (!pedido) {
          pedido = true;
          requestAnimationFrame(mover);
        }
      },
      { passive: true },
    );
  }

  ligarRevelar();
  ligarParallax();

  $("busca-campo").addEventListener("input", function () {
    renderLista("rapido");
  });
  $("ver-todos").addEventListener("click", function () {
    mostrarTodos = true;
    var primeiroNovo = LIMITE;
    inicioCascata = LIMITE;
    renderLista("cascata");
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

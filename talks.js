const talks = {
      "2026": [
        `<a href="https://aimsconference.org/AIMS-Conference/conf-reg2026/ss/Schedule.php?ssid=19">AIMS 2026 Conference</a>, Athens, Greece, July 6–10.`,
        `Analysis Seminar, University of Birmingham, UK, June 5.`,
        `<a href="http://tianyuan.amss.ac.cn/ztyt/info/2026/146143.html">Ergodic Theory and Dynamics of SDEs</a>, Tianyuan Mathematics Research Center, Kunming, March 22–28.`,
        `Analysis Seminar, Minzu University of China, Beijing, January 28.`
      ],
      "2025": [
        `Analysis Seminar, Morningside Center of Mathematics, Chinese Academy of Sciences, Beijing, November 20.`,
        `<a href="https://sites.google.com/view/hw-analysis/home">Heriot-Watt Analysis Seminar</a>, Edinburgh, November 5.`,
        `Poster, <a href="https://sites.google.com/view/workshop-spcs">International Symposium on Stochastic Processes and Complex Systems</a>, Tohoku University, Sendai, August 25–29.`,
        `<a href="https://zhenyao-sun.github.io/Events/SSSS2025.pdf">Stochastic Summer Seminar Series 2025</a>, Beijing Institute of Technology, July 1–4.`,
        `<a href="https://mm.scimeeting.cn/cn/minisite/index/29239">9th Annual Conference on Probability</a>, Central South University, Changsha, June 12–16.`,
        `Analysis Seminar, Morningside Center of Mathematics, Chinese Academy of Sciences, Beijing, May 15.`,
        `Analysis Seminar, Capital Normal University, Beijing, May 14.`,
        `Analysis Seminar, Jimei University, Xiamen, April 22.`,
        `非线性可积系统的分析与几何性质, Tsinghua University, Beijing, March 15–16.`
      ],
      "2024": [
        `<a href="https://math.bit.edu.cn/docs/2024-11/0dfbf9273fc14017bbd9d66908279392.pdf">Webinar on Stochastic Analysis 2024</a>, Beijing Institute of Technology, December 12.`,
        `<a href="https://blogs.ed.ac.uk/nbps/">NBPS</a>, University of Edinburgh, October 22.`,
        `Analysis Seminar, Beijing Institute of Technology, July 2.`,
        `Workshop: Harmonic Analysis and Nonlinear Dispersive PDEs, Henan Polytechnic University, June 23–28.`,
        `Research visit, Institute for Mathematics, TU Clausthal, Germany, June 10–19.`,
        `<a href="https://blogs.ed.ac.uk/analysis/analysis-seminar/">Edinburgh Analysis Seminar</a>, University of Edinburgh, February 5.`
      ],
      "2023": [
        `Seminar on Probability, Stochastic Analysis and Mathematical Finance, Shanghai Jiao Tong University, December 27.`,
        `<a href="https://indico.math.cnrs.fr/event/7274/">Numerical and Analytical Approaches for Nonlinear Dispersive PDEs</a>, Dijon, November 27–30.`,
        `Analysis Seminar, Morningside Center of Mathematics, Beijing, October 26.`,
        `Analysis seminars at ShanghaiTech University, Capital Normal University, IAPCM, and Beijing Institute of Technology, October 17–23.`,
        `<a href="https://iciam2023.org/registered_data?id=01229">Mini-symposium at the 10th ICIAM</a>, Waseda University, Tokyo, August 20–25.`,
        `<a href="https://web.mat.bham.ac.uk/Y.Wang/workshop2023/workshop2023.html">Random Dispersive PDEs 2023</a>, University of Birmingham, July 19–21.`,
        `Seminar talk, TU Clausthal, Germany, June 19.`,
        `<a href="http://www.macs.hw.ac.uk/~op4/3daysWS.html">Deterministic and Probabilistic Dynamics of Nonlinear Dispersive PDEs</a>, Maxwell Institute, June 14–16 (co-organizer and speaker).`,
        `Junior Analysis and Probability Seminar, University of Warwick, February.`,
        `APDE Webinar, China, January.`
      ],
      "2022": [
        `Workshop on Stochastics and Nonlinear PDEs, Osaka University, December.`,
        `NLPDE Seminar, Kyoto University, December.`,
        `Special Analysis Seminar, Chuo University, Tokyo, November.`,
        `<a href="http://www.rimath-saitama-u.sakura.ne.jp/seminar/kaiseki/2022/11/11/326/">104th Analysis Seminar</a>, Saitama University, November.`,
        `One-day workshop on nonlinear stochastic PDE, Keio University, November.`,
        `<a href="https://www.maths.ed.ac.uk/~gli/pdf/poster_GLi.pdf">Poster: Trials in Wave Turbulence</a>, Gran Sasso Science Institute, September 5–10.`,
        `Probabilistic Aspects of Nonlinear Dispersive Equations, University of Birmingham, July.`,
        `Harmonic Analysis, Stochastics and PDEs in honour of Nicolai Krylov, ICMS, June 20–24.`,
        `Dispersive Day 2022, Maxwell Institute, June.`
      ],
      "2020–2019": [
        `Virtual Maxwell Analysis Seminar, Maxwell Institute, June 2020.`,
        `Nonlinear and Stochastic Partial Differential Equations, RIMS Kyoto, November 2019.`
      ]
    };

const talkOrder = ["2026", "2025", "2024", "2023", "2022", "2020–2019"];

talkOrder.forEach((year, index) => {
  const items = talks[year];
  const el = document.createElement("details");
  el.className = "year-group";
  if (index === 0) el.open = true;
  el.innerHTML = `<summary>${year}<span>${items.length} ${items.length === 1 ? "entry" : "entries"}</span></summary><ul class="event-list">${items.map(item => `<li>${item}</li>`).join("")}</ul>`;
  document.querySelector("#talk-year-stack").append(el);
});


const publications = [
      {authors:"with J. Li, S. Liu, N. Tzvetkov, T. Oh",title:"Probabilistic well-posedness of dispersive PDEs beyond variance blowup II: quadratic nonlinear wave equation",venue:"Preprint",year:"2026",links:[]},
      {authors:"with A. Chapouto, M. Gubinelli, J. Li, T. Oh",title:"Nonlinear PDEs with modulated dispersion III: multiplicative noises",venue:"Preprint",year:"2026",links:[["arXiv","https://arxiv.org/abs/2607.08385"]]},
      {authors:"with A. Chapouto, T. Oh",title:"Deep- and shallow-water convergence of the generalized Gibbs measures for the intermediate long wave equation",venue:"Journées Équations aux Dérivées Partielles (2025), Exposé no. 1, 16 p.",year:"2025",links:[["Article","https://proceedings.centre-mersenne.org/articles/10.5802/jedp.692/"]]},
      {authors:"with A. Chapouto, B. Harrop-Griffiths, T. Oh",title:"On the singular nature of shallow-water convergence of the intermediate long wave equation on the real line",venue:"Preprint",year:"2026",links:[["arXiv","https://arxiv.org/abs/2602.20695"]]},
      {authors:"with J. Li, L. Tolomeo",title:"A remark on the log-Sobolev inequality for the Gibbs measure of the focusing Schrödinger equation",venue:"Journal of Dynamics and Differential Equations (2026)",year:"2026",links:[["Journal","https://link.springer.com/article/10.1007/s10884-026-10509-y"],["arXiv","https://arxiv.org/abs/2512.03897"]]},
      {authors:"with A. Chapouto, T. Oh, T. Zhao",title:"Shallow-water convergence of the intermediate long wave equation in L²",venue:"Preprint",year:"2025",links:[["arXiv","https://arxiv.org/abs/2511.15905"]]},
      {authors:"with J. Li, T. Oh, N. Tzvetkov",title:"Probabilistic well-posedness of dispersive PDEs beyond variance blowup I: Benjamin–Bona–Mahony equation",venue:"Preprint",year:"2025",links:[["arXiv","https://arxiv.org/abs/2509.02344"]]},
      {authors:"with M. Gubinelli, J. Li, T. Oh",title:"Nonlinear PDEs with modulated dispersion IV: normal form approach and unconditional uniqueness",venue:"Peking Mathematical Journal (2026)",year:"2026",links:[["Journal","https://doi.org/10.1007/s42543-026-00123-8"],["arXiv","https://arxiv.org/abs/2505.24270"]]},
      {authors:"with K. Chouk, M. Gubinelli, J. Li, T. Oh",title:"Nonlinear PDEs with modulated dispersion II: Korteweg–de Vries equation",venue:"Preprint",year:"2025",links:[["arXiv","https://arxiv.org/abs/1406.7675"]]},
      {authors:"with M. Okamoto, L. Tao",title:"Global well-posedness of the energy-critical stochastic nonlinear Schrödinger equation on the three-dimensional torus",venue:"Preprint",year:"2024",links:[["arXiv","https://arxiv.org/abs/2407.15108"]]},
      {authors:"with Á. Bényi, R. H. Torres, T. Oh",title:"Compact T(1) theorem à la Stein",venue:"Journal of Functional Analysis 289 (2025), no. 7, 111052",year:"2025",links:[["Journal","https://doi.org/10.1016/j.jfa.2025.111052"],["arXiv","https://arxiv.org/abs/2405.08416"]]},
      {authors:"with Á. Bényi, R. H. Torres, T. Oh",title:"Compact bilinear operators and paraproducts revisited",venue:"Canadian Mathematical Bulletin 68 (2025), no. 1, 44–59",year:"2025",links:[["Journal","https://doi.org/10.4153/S000843952400047X"],["arXiv","https://arxiv.org/abs/2405.08412"]]},
      {authors:"with J. Forlano, T. Zhao",title:"Unconditional deep-water limit of the intermediate long wave equation in low regularity",venue:"NoDEA 32 (2025), no. 2, Paper 28",year:"2025",links:[["Journal","https://doi.org/10.1007/s00030-025-01037-7"],["arXiv","https://arxiv.org/abs/2403.06554"]]},
      {authors:"with L. Tao, T. Zhao",title:"Global well-posedness of the energy-critical stochastic Hartree nonlinear wave equation",venue:"Stochastic Partial Differential Equations: Analysis and Computations (2025)",year:"2025",links:[["Journal","https://doi.org/10.1007/s40072-025-00389-6"],["arXiv","https://arxiv.org/abs/2310.14517v2"]]},
      {authors:"with A. Chapouto, T. Oh",title:"Deep-water and shallow-water limits of statistical equilibria for the intermediate long wave equation",venue:"Preprint",year:"2024",links:[["arXiv","https://arxiv.org/abs/2409.06905"]]},
      {authors:"with A. Chapouto, J. Forlano, T. Oh, D. Pilod",title:"Intermediate long wave equation in negative Sobolev spaces",venue:"Proceedings of the AMS, Series B 11 (2024), 452–468",year:"2024",links:[["Journal","https://doi.org/10.1090/bproc/206"],["arXiv","https://arxiv.org/abs/2311.08142"]]},
      {authors:"with A. Chapouto, T. Oh, D. Pilod",title:"Deep-water limit of the intermediate long wave equation in L²",venue:"Mathematical Research Letters 31 (2024), no. 6, 1655–1692",year:"2024",links:[["Journal","https://link.intlpress.com/JDetail/1888970445406416898"],["arXiv","https://arxiv.org/abs/2311.07997"]]},
      {authors:"with E. Brun, R. Liu",title:"Global well-posedness of the energy-critical stochastic nonlinear wave equations",venue:"Journal of Differential Equations 397 (2024), 316–348",year:"2024",links:[["Journal","https://doi.org/10.1016/j.jde.2024.03.032"],["arXiv","https://arxiv.org/abs/2309.14946"]]},
      {authors:"with E. Brun, R. Liu, Y. Zine",title:"Global well-posedness of the one-dimensional fractional cubic nonlinear Schrödinger equations",venue:"Preprint",year:"2023",links:[["arXiv","https://arxiv.org/abs/2311.13370"]]},
      {authors:"with D. Greco, R. Liang, T. Oh, Y. Wang",title:"Optimal divergence rate of the focusing Gibbs measure",venue:"Preprint",year:"2023",links:[["arXiv","https://arxiv.org/abs/2310.08783"]]},
      {authors:"with A. Chapouto, R. Liu",title:"Global dynamics for the stochastic nonlinear beam equations on the four-dimensional torus",venue:"Proceedings of the Royal Society of Edinburgh A (2024)",year:"2024",links:[["Journal","https://doi.org/10.1017/prm.2024.87"],["arXiv","https://arxiv.org/abs/2312.13901"]]},
      {authors:"with T. Oh, G. Zheng",title:"On the deep-water and shallow-water limits of the intermediate long wave equation from a statistical viewpoint",venue:"Transactions of the London Mathematical Society 12 (2025), e70005",year:"2025",links:[["Journal","https://doi.org/10.1112/tlm3.70005"],["arXiv","https://arxiv.org/abs/2211.03243"]]},
      {authors:"",title:"Deep-water and shallow-water limits of the intermediate long wave equation",venue:"Nonlinearity 37 (2024), no. 7, 075001",year:"2024",links:[["Journal","https://doi.org/10.1088/1361-6544/ad4843"],["arXiv","https://arxiv.org/abs/2207.12088"]]},
      {authors:"with K. Cheung",title:"Global well-posedness of the 4-d energy-critical stochastic NLS with non-vanishing boundary condition",venue:"Funkcialaj Ekvacioj 65 (2022), no. 3, 287–309",year:"2022",links:[["Journal","https://doi.org/10.1619/fesi.65.287"],["arXiv","https://arxiv.org/abs/1910.02897"]]},
      {authors:"with K. Cheung, T. Oh",title:"Almost conservation laws for stochastic nonlinear Schrödinger equations",venue:"Journal of Evolution Equations 21 (2021), 1865–1894",year:"2021",links:[["Journal","https://doi.org/10.1007/s00028-020-00659-x"],["arXiv","https://arxiv.org/abs/1910.14558"]]}
    ];

const pubList = document.querySelector("#publication-list");
const pubSearch = document.querySelector("#publication-search");
const pubCount = document.querySelector("#publication-count");

function formatVenue(venue) {
  if (venue === "Preprint") return venue;
  const match = venue.match(/^(.*?)(?=\s+(?:\d+\s*\(|\(\d{4}\)))/);
  if (!match) return venue;
  return `<strong class="pub-journal">${match[1]}</strong>${venue.slice(match[1].length)}`;
}

function renderPublications() {
  const query = pubSearch.value.trim().toLowerCase();
  const matched = publications.filter(p =>
    `${p.title} ${p.authors} ${p.venue} ${p.year}`.toLowerCase().includes(query)
  );

  pubList.innerHTML = matched.map(p => {
    const mainLink = p.links[0]?.[1];
    const title = mainLink
      ? `<a href="${mainLink}" target="_blank" rel="noreferrer">${p.title}</a>`
      : p.title;
    const links = p.links.map(([label,url]) =>
      `<a href="${url}" target="_blank" rel="noreferrer">${label} ↗</a>`
    ).join("");
    const number = String(publications.indexOf(p) + 1).padStart(2, "0");
    const venueLine = p.venue === "Preprint" ? `Preprint · ${p.year}` : formatVenue(p.venue);
    return `<li class="publication-item"><span class="pub-number">${number}</span><div><h3 class="pub-title">${title}</h3>${p.authors ? `<p class="pub-authors">(${p.authors})</p>` : ""}<p class="pub-venue">${venueLine}</p>${links ? `<div class="pub-links">${links}</div>` : ""}</div></li>`;
  }).join("");

  pubCount.textContent = `Showing ${matched.length} of ${publications.length}`;
  if (!matched.length) pubList.innerHTML = '<li class="no-results">No publications match this search.</li>';
}

pubSearch.addEventListener("input", renderPublications);
renderPublications();

// Validator state: private state, explicit host context.
export function initialize(state,context){
state.valBusy = (false);

state.valAbort = (null);

state.valReport = (null);

state.valMessage = ('Velg IFC-filer og kjør validering.');

state.valFilter = ('all');

state.valProgress = ({total:0,current:null});

state.valUI = ({onlyIssues:false,open:new Set(),expanded:new Set(),report:null});

state.valStatusUI = ({'Godkjent':['ok','✓'],'Avvik':['error','!'],'Advarsler':['warning','△'],'Ikke relevant':['neutral','−'],'Kunne ikke kontrolleres':['incomplete','?']});

state.valFormatCache = (new Map());
}

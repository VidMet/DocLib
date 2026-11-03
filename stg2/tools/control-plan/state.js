// Private state and composition, initialized once per tool instance.
export function initialize(cp,context){
cp.cpConfig = null;
cp.cpStatus = 'Ikke konfigurert';
cp.cpIssues = [];
cp.cpReports = new Map();
cp.cpDeliveryFiles = [];
cp.cpControlFiles = [];
cp.cpDeliveryIds = new Set();
cp.cpControlIds = new Set();
cp.cpSelected = null;
cp.cpMetadataComplete = false;
cp.cpDraftText = '';
cp.cpMmiEvidence = new Map();
cp.cpDraftDocs = new Set();
cp.cpDraftModels = new Set();
cp.cpChecked = new Set();
cp.cpPendingLinks = [];
cp.cpPendingBase = null;
cp.cpPendingProject = null;
cp.cpLinkSession = null;
cp.cpExportBusy = false;
cp.cpTestPhases = [['EK','Egenkontroll'],['FK','Fagkontroll'],['TFK','Tverrfaglig kontroll'],['Godkjent','Godkjent']];









}

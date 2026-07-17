const PC={1:'var(--green)',2:'var(--orange)',3:'var(--red)',4:'var(--red)'};
const PN={1:'Low',2:'Medium',3:'High',4:'Urgent'};
const PCLS={1:'chip-low',2:'chip-med',3:'chip-high',4:'chip-urg'};
const SN={2:'Open',3:'Pending',4:'Resolved',5:'Closed',8:'ReOpen',9:'On-hold',11:'Waiting for local engineer'};
const SCLS={2:'chip-open',3:'chip-pending',4:'chip-resolved',5:'chip-closed',8:'chip-open',9:'chip-pending',11:'chip-pending'};

var OLLAMA_DEFAULTS={
    model:'qwen3.5:9b',
    stream:true,
    think:false,
    keep_alive:-1,
    options:{
        temperature:0.3,
        num_predict:200,
        num_ctx:4096,
        top_p:0.8,
        repeat_penalty:1.1
    }
};

import agentRunners from './agent/runners/client.js'
import aggregateRunners from './aggregate/runners/client.js'
import aiClassifierRunners from './ai_classifier/runners/client.js'
import apiRunners from './api/runners/client.js'
import chainOfThoughtRunners from './chain_of_thought/runners/client.js'
import conditionRunners from './condition/runners/client.js'
import cryptoRunners from './crypto/runners/client.js'
import delayRunners from './delay/runners/client.js'
import errorHandlerRunners from './error_handler/runners/client.js'
import filterRunners from './filter/runners/client.js'
import forEachRunners from './for_each/runners/client.js'
import forLoopRunners from './for_loop/runners/client.js'
import functionRunners from './function/runners/client.js'
import httpResponseRunners from './http_response/runners/client.js'
import ifElseRunners from './if_else/runners/client.js'
import ifElseIfElseRunners from './if_elseif_else/runners/client.js'
import imageUrlPreviewRunners from './image_url_preview/runners/client.js'
import imageUrlToBase64Runners from './image_url_to_base64/runners/client.js'
import jsonMapRunners from './json_map/runners/client.js'
import jsonPathRunners from './json_path/runners/client.js'
import loopRunners from './loop/runners/client.js'
import mapperRunners from './mapper/runners/client.js'
import masterAgentRunners from './master_agent/runners/client.js'
import mcpRunners from './mcp/runners/client.js'
import mergeRunners from './merge/runners/client.js'
import mongodbRunners from './mongodb/runners/client.js'
import ns9IngestRunners from './ns9_ingest/runners/client.js'
import ns9QueryRunners from './ns9_query/runners/client.js'
import ns9RlhfRunners from './ns9_rlhf/runners/client.js'
import parallelRunners from './parallel/runners/client.js'
import postgresqlRunners from './postgresql/runners/client.js'
import redisRunners from './redis/runners/client.js'
import responseRunners from './response/runners/client.js'
import routerRunners from './router/runners/client.js'
import saveToFilesRunners from './save_to_files/runners/client.js'
import scheduleRunners from './schedule/runners/client.js'
import showPreviewRunners from './show_preview/runners/client.js'
import skillRunners from './skill/runners/client.js'
import slackRunners from './slack/runners/client.js'
import slaveAgentRunners from './slave_agent/runners/client.js'
import smtpRunners from './smtp/runners/client.js'
import sortRunners from './sort/runners/client.js'
import starterRunners from './starter/runners/client.js'
import subWorkflowRunners from './sub_workflow/runners/client.js'
import switchCaseRunners from './switch_case/runners/client.js'
import tableRunners from './table/runners/client.js'
import textTemplateRunners from './text_template/runners/client.js'
import userInputRunners from './user_input/runners/client.js'
import variablesRunners from './variables/runners/client.js'
import waitRunners from './wait/runners/client.js'
import webhookRequestRunners from './webhook_request/runners/client.js'

const allRunners = [
  ...agentRunners,
  ...aggregateRunners,
  ...aiClassifierRunners,
  ...apiRunners,
  ...chainOfThoughtRunners,
  ...conditionRunners,
  ...cryptoRunners,
  ...delayRunners,
  ...errorHandlerRunners,
  ...filterRunners,
  ...forEachRunners,
  ...forLoopRunners,
  ...functionRunners,
  ...httpResponseRunners,
  ...ifElseRunners,
  ...ifElseIfElseRunners,
  ...imageUrlPreviewRunners,
  ...imageUrlToBase64Runners,
  ...jsonMapRunners,
  ...jsonPathRunners,
  ...loopRunners,
  ...mapperRunners,
  ...masterAgentRunners,
  ...mcpRunners,
  ...mergeRunners,
  ...mongodbRunners,
  ...ns9IngestRunners,
  ...ns9QueryRunners,
  ...ns9RlhfRunners,
  ...parallelRunners,
  ...postgresqlRunners,
  ...redisRunners,
  ...responseRunners,
  ...routerRunners,
  ...saveToFilesRunners,
  ...scheduleRunners,
  ...showPreviewRunners,
  ...skillRunners,
  ...slackRunners,
  ...slaveAgentRunners,
  ...smtpRunners,
  ...sortRunners,
  ...starterRunners,
  ...subWorkflowRunners,
  ...switchCaseRunners,
  ...tableRunners,
  ...textTemplateRunners,
  ...userInputRunners,
  ...variablesRunners,
  ...waitRunners,
  ...webhookRequestRunners,
]

export const coreBlockRunners = new Map(allRunners.map(r => [r.type, r.run]))

import fs from 'fs'
import { createNamespaceIfNotExists } from './cluster'
import { execCmdWithExitOnFailure } from './cmd-utils'
import {
  DynamicEnvVar,
  envVar,
  fetchEnv,
  fetchEnvOrFallback,
  getDynamicEnvVarValue,
} from './env-utils'
import {
  installGenericHelmChart,
  isCelotoolHelmDryRun,
  removeGenericHelmChart,
  setHelmArray,
  upgradeGenericHelmChart,
} from './helm_deploy'
import { BaseClusterConfig, CloudProvider } from './k8s-cluster/base'
import { GCPClusterConfig } from './k8s-cluster/gcp'
import { outputIncludes } from './utils'
const yaml = require('js-yaml')

const helmChartPath = '../helm-charts/prometheus-stackdriver'
const releaseName = 'prometheus-stackdriver'
const kubeNamespace = 'prometheus'
const kubeServiceAccountName = releaseName
// Prometheus container registry with latest tags: https://hub.docker.com/r/prom/prometheus/tags
const prometheusImageTag = 'v2.27.1'

const GKEWorkloadMetricsHelmChartPath = '../helm-charts/gke-workload-metrics'
const GKEWorkloadMetricsReleaseName = 'gke-workload-metrics'

const grafanaHelmChartPath = '../helm-charts/grafana'
const grafanaReleaseName = 'grafana'

export async function installPrometheusIfNotExists(
  context?: string,
  clusterConfig?: BaseClusterConfig
) {
  const prometheusExists = await outputIncludes(
    `helm list -n prometheus`,
    releaseName,
    `prometheus-stackdriver exists, skipping install`
  )
  if (!prometheusExists) {
    console.info('Installing prometheus-stackdriver')
    await installPrometheus(context, clusterConfig)
  }
}

async function installPrometheus(context?: string, clusterConfig?: BaseClusterConfig) {
  await createNamespaceIfNotExists(kubeNamespace)
  return installGenericHelmChart(
    kubeNamespace,
    releaseName,
    helmChartPath,
    await helmParameters(context, clusterConfig)
  )
}

export async function removePrometheus() {
  await removeGenericHelmChart(releaseName, kubeNamespace)
}

export async function upgradePrometheus(context?: string, clusterConfig?: BaseClusterConfig) {
  await createNamespaceIfNotExists(kubeNamespace)
  return upgradeGenericHelmChart(
    kubeNamespace,
    releaseName,
    helmChartPath,
    await helmParameters(context, clusterConfig)
  )
}

function getK8sContextVars(
  clusterConfig?: BaseClusterConfig,
  context?: string
): [string, string, string, boolean] {
  const usingGCP = !clusterConfig || clusterConfig.cloudProvider === CloudProvider.GCP
  let clusterName = usingGCP ? fetchEnv(envVar.KUBERNETES_CLUSTER_NAME) : clusterConfig!.clusterName
  let gcloudProject, gcloudRegion

  if (context) {
    gcloudProject = getDynamicEnvVarValue(
      DynamicEnvVar.PROM_SIDECAR_GCP_PROJECT,
      { context },
      fetchEnv(envVar.TESTNET_PROJECT_NAME)
    )
    gcloudRegion = getDynamicEnvVarValue(
      DynamicEnvVar.PROM_SIDECAR_GCP_REGION,
      { context },
      fetchEnv(envVar.KUBERNETES_CLUSTER_ZONE)
    )
    clusterName = getDynamicEnvVarValue(
      DynamicEnvVar.KUBERNETES_CLUSTER_NAME,
      { context },
      clusterName
    )
  } else {
    gcloudProject = fetchEnv(envVar.TESTNET_PROJECT_NAME)
    gcloudRegion = fetchEnv(envVar.KUBERNETES_CLUSTER_ZONE)
  }

  return [clusterName, gcloudProject, gcloudRegion, usingGCP]
}

function getRemoteWriteParameters(context?: string): string[] {
  const remoteWriteUrl = getDynamicEnvVarValue(
    DynamicEnvVar.PROM_REMOTE_WRITE_URL,
    { context },
    fetchEnv(envVar.PROMETHEUS_REMOTE_WRITE_URL)
  )
  const remoteWriteUser = getDynamicEnvVarValue(
    DynamicEnvVar.PROM_REMOTE_WRITE_USERNAME,
    { context },
    fetchEnv(envVar.PROMETHEUS_REMOTE_WRITE_USERNAME)
  )
  const remoteWritePassword = getDynamicEnvVarValue(
    DynamicEnvVar.PROM_REMOTE_WRITE_PASSWORD,
    { context },
    fetchEnv(envVar.PROMETHEUS_REMOTE_WRITE_PASSWORD)
  )
  return [
    `--set remote_write.url='${remoteWriteUrl}'`,
    `--set remote_write.basic_auth.username='${remoteWriteUser}'`,
    `--set remote_write.basic_auth.password='${remoteWritePassword}'`,
  ]
}

async function helmParameters(context?: string, clusterConfig?: BaseClusterConfig) {
  const [clusterName, gcloudProject, gcloudRegion, usingGCP] = getK8sContextVars(
    clusterConfig,
    context
  )

  const params = [
    `--set namespace=${kubeNamespace}`,
    `--set gcloud.project=${gcloudProject}`,
    `--set gcloud.region=${gcloudRegion}`,
    `--set prometheus.imageTag=${prometheusImageTag}`,
    `--set serviceAccount.name=${kubeServiceAccountName}`,
    `--set cluster=${clusterName}`,
  ]

  // Remote write to Grafana Cloud
  if (fetchEnvOrFallback(envVar.PROMETHEUS_REMOTE_WRITE_URL, '') !== '') {
    params.push(...getRemoteWriteParameters(context))
  }

  if (usingGCP) {
    // Note: ssd is not the default storageClass in GCP clusters
    params.push(`--set storageClassName=ssd`)
  } else if (context?.startsWith('AZURE_ODIS')) {
    params.push(`--set storageClassName=default`)
  }

  // Set scrape job if set for the context
  if (context) {
    const scrapeJobName = getDynamicEnvVarValue(DynamicEnvVar.PROM_SCRAPE_JOB_NAME, { context }, '')
    const scrapeTargets = getDynamicEnvVarValue(DynamicEnvVar.PROM_SCRAPE_TARGETS, { context }, '')
    const scrapeLabels = getDynamicEnvVarValue(DynamicEnvVar.PROM_SCRAPE_LABELS, { context }, '')

    if (scrapeJobName !== '') {
      params.push(`--set scrapeJob.Name=${scrapeJobName}`)
    }

    if (scrapeTargets !== '') {
      const targetParams = setHelmArray('scrapeJob.Targets', scrapeTargets.split(','))
      params.push(...targetParams)
    }

    if (scrapeLabels !== '') {
      const labelParams = setHelmArray('scrapeJob.Labels', scrapeLabels.split(','))
      params.push(...labelParams)
    }
  }

  return params
}

export async function installGrafanaIfNotExists(
  context?: string,
  clusterConfig?: BaseClusterConfig
) {
  const grafanaExists = await outputIncludes(
    `helm list -A`,
    grafanaReleaseName,
    `grafana exists, skipping install`
  )
  if (!grafanaExists) {
    console.info('Installing grafana')
    await installGrafana(context, clusterConfig)
  }
}

async function installGrafana(context?: string, clusterConfig?: BaseClusterConfig) {
  await createNamespaceIfNotExists(kubeNamespace)
  return installGenericHelmChart(
    kubeNamespace,
    grafanaReleaseName,
    grafanaHelmChartPath,
    await grafanaHelmParameters(context, clusterConfig),
    // Adding this file and clabs' default values file.
    true,
    'values-clabs.yaml'
  )
}

export async function upgradeGrafana(context?: string, clusterConfig?: BaseClusterConfig) {
  await createNamespaceIfNotExists(kubeNamespace)
  return upgradeGenericHelmChart(
    kubeNamespace,
    grafanaReleaseName,
    grafanaHelmChartPath,
    await grafanaHelmParameters(context, clusterConfig),
    // Adding this file and clabs' default values file.
    'values-clabs.yaml'
  )
}

export async function removeGrafanaHelmRelease() {
  const grafanaExists = await outputIncludes(`helm list -A`, grafanaReleaseName)
  if (grafanaExists) {
    console.info('Removing grafana')
    await removeGenericHelmChart(grafanaReleaseName, kubeNamespace)
  }
}

async function grafanaHelmParameters(context?: string, clusterConfig?: BaseClusterConfig) {
  // Grafana chart is a copy from source. No changes done directly on the chart.
  const [k8sClusterName] = getK8sContextVars(clusterConfig, context)
  const k8sDomainName = fetchEnv(envVar.CLUSTER_DOMAIN_NAME)
  // Rename baklavastaging -> baklava
  const grafanaUrl =
    k8sClusterName !== 'baklavastaging'
      ? `${k8sClusterName}-grafana.${k8sDomainName}.org`
      : `baklava-grafana.${k8sDomainName}.org`
  const values = {
    adminPassword: fetchEnv(envVar.GRAFANA_LOCAL_ADMIN_PASSWORD),
    'grafana.ini': {
      server: {
        root_url: `https://${grafanaUrl}`,
      },
      'auth.google': {
        client_id: fetchEnv(envVar.GRAFANA_LOCAL_OAUTH2_CLIENT_ID),
        client_secret: fetchEnv(envVar.GRAFANA_LOCAL_OAUTH2_CLIENT_SECRET),
      },
    },
    ingress: {
      hosts: [grafanaUrl],
      tls: [
        {
          secretName: `${k8sClusterName}-grafana-tls`,
          hosts: [grafanaUrl],
        },
      ],
    },
  }

  const valuesFile = '/tmp/grafana-values.yaml'
  fs.writeFileSync(valuesFile, yaml.safeDump(values))

  // Adding this file and clabs' default values file.
  const params = [`-f ${valuesFile}`]
  return params
}

// See https://cloud.google.com/stackdriver/docs/solutions/gke/managing-metrics#enable-workload-metrics
async function enableGKESystemAndWorkloadMetrics(
  clusterID: string,
  zone: string,
  gcloudProjectName: string
) {
  const GKEWMEnabled = await outputIncludes(
    `gcloud beta container clusters describe ${clusterID} --zone=${zone} --project=${gcloudProjectName} --format="value(monitoringConfig.componentConfig.enableComponents)"`,
    'WORKLOADS',
    `GKE cluster ${clusterID} in zone ${zone} and project ${gcloudProjectName} has GKE workload metrics enabled, skipping gcloud beta container clusters update`
  )

  if (!GKEWMEnabled) {
    if (isCelotoolHelmDryRun()) {
      console.info(
        `Skipping enabling GKE workload metrics for cluster ${clusterID} in zone ${zone} and project ${gcloudProjectName} due to --helmdryrun`
      )
    } else {
      await execCmdWithExitOnFailure(
        `gcloud beta container clusters update ${clusterID} --zone=${zone} --project=${gcloudProjectName} --monitoring=SYSTEM,WORKLOAD`
      )
    }
  }
}

async function GKEWorkloadMetricsHelmParameters(clusterConfig?: BaseClusterConfig) {
  // Abandon if not using GCP, it's GKE specific.
  if (clusterConfig && clusterConfig.cloudProvider !== CloudProvider.GCP) {
    console.error('Cannot create gke-workload-metrics in a non GCP k8s cluster, skipping')
    process.exit(1)
  }

  const clusterName = clusterConfig
    ? clusterConfig!.clusterName
    : fetchEnv(envVar.KUBERNETES_CLUSTER_NAME)

  const params = [`--set cluster=${clusterName}`]
  return params
}

export async function installGKEWorkloadMetricsIfNotExists(clusterConfig?: BaseClusterConfig) {
  const GKEWMExists = await outputIncludes(
    `helm list -A`,
    GKEWorkloadMetricsReleaseName,
    `gke-workload-metrics exists, skipping install`
  )
  if (!GKEWMExists) {
    console.info('Installing gke-workload-metrics')
    await installGKEWorkloadMetrics(clusterConfig)
  }
}

async function installGKEWorkloadMetrics(clusterConfig?: BaseClusterConfig) {
  // Abandon if not using GCP, it's GKE specific.
  if (clusterConfig && clusterConfig.cloudProvider !== CloudProvider.GCP) {
    console.error('Cannot create gke-workload-metrics in a non GCP k8s cluster, skipping')
    process.exit(1)
  }

  let k8sClusterName, k8sClusterZone, gcpProjectName
  if (clusterConfig) {
    const configGCP = clusterConfig as GCPClusterConfig
    k8sClusterName = configGCP!.clusterName
    k8sClusterZone = configGCP!.zone
    gcpProjectName = configGCP!.projectName
  } else {
    k8sClusterName = fetchEnv(envVar.KUBERNETES_CLUSTER_NAME)
    k8sClusterZone = fetchEnv(envVar.KUBERNETES_CLUSTER_ZONE)
    gcpProjectName = fetchEnv(envVar.TESTNET_PROJECT_NAME)
  }

  await enableGKESystemAndWorkloadMetrics(k8sClusterName, k8sClusterZone, gcpProjectName)

  await createNamespaceIfNotExists(kubeNamespace)
  return installGenericHelmChart(
    kubeNamespace,
    GKEWorkloadMetricsReleaseName,
    GKEWorkloadMetricsHelmChartPath,
    await GKEWorkloadMetricsHelmParameters(clusterConfig)
  )
}

export async function upgradeGKEWorkloadMetrics(clusterConfig?: BaseClusterConfig) {
  const params = await GKEWorkloadMetricsHelmParameters(clusterConfig)

  await createNamespaceIfNotExists(kubeNamespace)
  return upgradeGenericHelmChart(
    kubeNamespace,
    GKEWorkloadMetricsReleaseName,
    GKEWorkloadMetricsHelmChartPath,
    params
  )
}

export async function removeGKEWorkloadMetrics() {
  const GKEWMExists = await outputIncludes(`helm list -A`, GKEWorkloadMetricsReleaseName)
  if (GKEWMExists) {
    console.info('Removing gke-workload-metrics')
    await removeGenericHelmChart(GKEWorkloadMetricsReleaseName, kubeNamespace)
  }
}

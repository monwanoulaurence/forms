#!/bin/bash
# deploy.sh — Script de déploiement clé en main
# Usage : ./deploy.sh
# Lance tout le projet en partant de zéro

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║     DEVOPS AUTH — Déploiement automatique    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""


echo " Vérification des prérequis..."

if ! command -v ansible &> /dev/null; then
  echo " Ansible n'est pas installé."
  echo "   Lancez : sudo apt install ansible -y"
  exit 1
fi

if [ ! -f ~/.ssh/id_ed25519 ]; then
  echo " Clé SSH introuvable (~/.ssh/id_ed25519)"
  echo "   Copiez votre clé SSH : cp /mnt/c/Users/monwa/.ssh/id_ed25519 ~/.ssh/id_ed25519 && chmod 600 ~/.ssh/id_ed25519"
  exit 1
fi

echo " Prérequis OK"
echo ""

# Demander les IP
echo " Entrez les IPs de vos VMs OVH :"
echo ""
read -p "  IP du Master  (k8s-master)  : " MASTER_IP
read -p "  IP du Worker  (k8s-worker)  : " WORKER_IP
read -p "  IP du Staging (todo-staging): " STAGING_IP
echo ""

#Validation des IPS
if [[ -z "$MASTER_IP" || -z "$WORKER_IP" ]]; then
  echo " Les IPs du master et du worker sont obligatoires."
  exit 1
fi


echo " Génération du fichier inventory.ini..."
cat > infra/ansible/inventory.ini << EOF
[k8s_master]
master ansible_host=${MASTER_IP} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_ed25519

[k8s_worker]
worker ansible_host=${WORKER_IP} ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/id_ed25519

[k8s:children]
k8s_master
k8s_worker
EOF

echo " inventory.ini généré"

#Mise à jour des secrets du github
echo ""
echo "  N'oubliez pas de mettre à jour le secret GitHub :"
echo "   K8S_MASTER_HOST = ${MASTER_IP}"
echo "   STAGING_HOST    = ${STAGING_IP}"
echo ""
read -p "Appuyez sur Entrée pour continuer le déploiement..."

# Ajouter les clés SSH 
echo ""
echo " Ajout des clés SSH connues..."
ssh-keyscan -H ${MASTER_IP} >> ~/.ssh/known_hosts 2>/dev/null
ssh-keyscan -H ${WORKER_IP} >> ~/.ssh/known_hosts 2>/dev/null
echo " Clés SSH ajoutées"


#PlayBook Ansible
echo ""
echo " Lancement du playbook Ansible..."
echo "    Durée estimée : 10-15 minutes"
echo ""

ansible-playbook infra/ansible/setup-k8s.yml -i infra/ansible/inventory.ini



echo ""
echo " Déploiement du dashboard Grafana..."
ssh -i ~/.ssh/id_ed25519 ubuntu@${MASTER_IP} "sudo chown -R ubuntu:ubuntu ~/k8s"
ssh -i ~/.ssh/id_ed25519 ubuntu@${MASTER_IP} "sudo kubectl apply -f ~/k8s/base/grafana-dashboard.yaml"
echo " Dashboard Grafana déployé"



echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║             DÉPLOIEMENT TERMINÉ !           ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo " Application : http://${MASTER_IP}:30080"
echo " Grafana     : http://${MASTER_IP}:31000"
echo "               Login : admin / devops2024"
echo " Prometheus  : http://${MASTER_IP}:31090"
echo ""

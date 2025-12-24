# Simplified Extract HTML

> Résumé
Extension Firefox permettant de sélectionner visuellement des éléments d'une page web et d'en extraire un HTML épuré, centré sur le contenu et la structure, prêt à être réutilisé.
>

## 1. Pourquoi ce projet existe

- Problème ou besoin initial: copier du contenu web "avec sa structure" est soit trop pauvre (copier du texte), soit trop verbeux (copier du HTML/DOM brut), et le nettoyage est pénible et répétitif.
- Pourquoi ça mérite d'exister maintenant: les pages modernes génèrent beaucoup de bruit (wrappers, décoratif, attributs techniques), et le besoin de réutiliser rapidement un extrait structuré (sans le rendu) est fréquent.

## 2. Objectif & fin claire

- Objectif concret recherché: obtenir, depuis une page web, un extrait HTML volontairement simplifié qui conserve les données et la structure utiles, et qui est copiable en une action.
- Le projet est considéré comme terminé quand:
    - L'extension permet d'entrer en mode sélection via clic sur l'icône, de sélectionner/désélectionner plusieurs éléments, puis de "copier & générer".
    - Les sélections sont fusionnées dans l'ordre du DOM et encapsulées dans un conteneur unique incluant l'URL.
    - Le HTML généré applique les règles d'épuration (blacklist tags, allowlist attributs, suppression wrappers vides ou à enfant unique) et sort tel quel (pas de formatage, pas de normalisation d'espaces).
    - Le résultat final est copié dans le presse-papiers.

## 3. Périmètre

Ce que le projet fait volontairement, et ce qu'il ne fera pas.

- Inclus:
    - Sélection visuelle d'un ou plusieurs éléments d'une page.
    - Extraction du sous-arbre DOM correspondant, puis simplification agressive orientée "contenu".
    - Fusion multi-sélections triée par ordre DOM, concaténée "à la chaîne".
    - Encapsulation avec l'URL source dans une balise racine dédiée.
    - Copie dans le presse-papiers.
- Exclu:
    - Conversion en Markdown, composant UI, ou autre format que HTML.
    - Copie de CSS calculé, styles inline, ou objectif de reproduction fidèle du rendu.
    - "Pretty print" ou reformatage du HTML généré.
    - Normalisation/collapse des espaces dans les text nodes.
    - Conversion des URLs relatives en absolues.
    - Configuration utilisateur (listes en dur dans l'extension, pas d'écran Options, pour l'instant).
    - Limitation de taille, troncature, ou alertes "extrait trop gros".

## 4. Idée centrale

Le cœur de l'idée, sans parler d'implémentation.

- Principe clé: capturer une portion de DOM choisie par l'utilisateur, puis la réécrire en une version minimaliste qui garde le sens et jette le bruit.
- Logique générale / règles importantes:
    - Garder les éléments "sémantiques" (structurels) et les données de contenu.
    - Supprimer les éléments décoratifs/techniques via une blacklist.
    - Ne conserver que certains attributs informatifs via une allowlist.
    - Réduire la profondeur en supprimant les wrappers seulement s'ils sont vides ou s'ils n'ont qu'un seul enfant.
    - Retirer des redondances évidentes (ex. un `h1` qui ne fait que contenir un autre `h1`).
- Cible ou usage principal: produire un extrait web structuré, réutilisable tel quel ailleurs, sans passer par du nettoyage manuel ou du HTML brut.

## 5. Fonctionnement réel

Comment ça se passe concrètement.

- Entrées:
    - Page web active (URL `pageUrl`).
    - Un ou plusieurs éléments sélectionnés visuellement.
- Transformation:
    - Extraction des sous-arbres DOM de chaque sélection.
    - Tri des sélections selon l'ordre réel dans le DOM.
    - Simplification:
        - Suppression des balises blacklistées.
        - Suppression des attributs non autorisés, selon allowlist par tag.
        - Suppression des wrappers vides ou à enfant unique (remontée de l'enfant).
        - Conservation du texte tel quel (espaces et retours inchangés).
    - Sérialisation brute en HTML sans formatage.
- Sorties:
    - Une chaîne HTML unique copiée dans le presse-papiers:
      `<simplified-extract-html data-source="${pageUrl}">...</simplified-extract-html>`
- Exemple simple d'usage:
    - Sur une page produit, l'utilisateur sélectionne:
        - le bloc "Produit A"
        - le bloc "Produit B"
      puis clique "copier & générer".
      L'extension copie un seul extrait:
      ```html
      <simplified-extract-html data-source="https://exemple.com/page">
        <section>
          <h2>Produit A</h2>
          <a href="/...">...</a>
          <span>Prix: ...</span>
        </section>
        <section>
          <h2>Produit B</h2>
          ...
        </section>
      </simplified-extract-html>
      ```

## 6. Contenu attendu (MVP)

Le minimum nécessaire pour que le projet soit "utile".

- Élément 1: Mode sélection activé par clic sur l'icône (overlay + surlignage), clic = toggle sélection, bouton "copier & générer".
- Élément 2: Pipeline d'extraction + simplification + copie presse-papiers, avec fusion multi-sélections triée par ordre DOM.
- Limite volontaire du MVP:
    - Listes blacklist/allowlist codées en dur.
    - Pas de paramètres, pas de presets, pas de limite de taille, pas d'absolutisation d'URLs.

## 7. Évolutions possibles (hors MVP)

Ce que le projet pourrait devenir, sans engagement.

- Fonctionnalités envisagées:
    - Page Options pour éditer blacklist/allowlist (JSON) et exporter/importer des presets.
    - Option "absolutize links" (transformer `href/src` relatifs en absolus).
    - Option "whitespace policy" (collapse des espaces, avec exceptions `pre/code`).
    - Mode "segments" (encapsuler chaque sélection dans un wrapper interne pour garder la trace des blocs).
- Variantes ou extensions possibles:
    - Export alternatif en texte structuré (sans changer l'extraction).
    - Raccourcis clavier pour entrer/sortir du mode sélection et copier.
- Ce que ça apporterait de plus:
    - Réduction du bruit sur des pages extrêmes, contrôle fin, et adaptation à différents types de sites.

## 8. Contraintes

Règles non négociables.

- Type de projet:
    - Extension Firefox orientée sélection DOM et génération d'un HTML épuré.
- Contraintes techniques ou de format:
    - Sortie unique: `<simplified-extract-html data-source="${pageUrl}">...</simplified-extract-html>`.
    - Fusion multi-sélections: ordre du DOM, concaténation simple.
    - Pas de formatage HTML (pas de pretty print).
    - Pas de normalisation des espaces dans le texte.
    - Pas de `data-*`.
    - Allowlist d'attributs (déjà fixée):
        - Globaux: `aria-*`, `role`
        - Liens/média: `href`, `src`, `alt`, `title`
        - Formulaires: `value`, `name`, `checked`, `selected`, `placeholder`, `type`
    - Wrappers: suppression seulement si vide ou à enfant unique.
- Contraintes pratiques (temps, perf, taille, coût):
    - Pas de garde-fou de taille (le presse-papiers peut recevoir un extrait très gros).
    - Les règles doivent rester déterministes et simples (éviter heuristiques "smart" qui surprennent).

## 9. Notes

- Décisions importantes prises:
- Idées futures possibles:
- Liens ou références utiles:
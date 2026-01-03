#!/bin/bash

# Create output directory
mkdir -p public/images/checklists

# Function to generate OG image
generate_og_image() {
  local slug=$1
  local title=$2
  local category=$3
  local difficulty=$4
  local item_count=$5
  local bg_color=$6
  local light_color=$7
  local diff_color=$8
  
  local output="public/images/checklists/${slug}-og.png"
  
  # Create gradient background
  convert -size 1200x630 \
    gradient:"${bg_color}"-"${light_color}" \
    -swirl 0 \
    $output
  
  # Add white content box with shadow
  convert $output \
    -fill 'rgba(255,255,255,0.95)' \
    -draw 'rectangle 60,60 1140,570' \
    $output
  
  # Add category badge
  convert $output \
    -fill "${bg_color}" \
    -draw 'rectangle 100,100 240,136' \
    -fill white \
    -font Arial-Bold -pointsize 16 \
    -gravity NorthWest \
    -annotate +112+116 "${category^^}" \
    $output
  
  # Add difficulty badge
  convert $output \
    -fill "${diff_color}" \
    -draw 'rectangle 260,100 380,136' \
    -fill white \
    -font Arial-Bold -pointsize 16 \
    -gravity NorthWest \
    -annotate +268+116 "${difficulty^^}" \
    $output
  
  # Add title (multiline support)
  local title_y=220
  IFS='|' read -ra LINES <<< "$title"
  for line in "${LINES[@]}"; do
    convert $output \
      -fill '#1f2937' \
      -font Arial-Bold -pointsize 64 \
      -gravity NorthWest \
      -annotate +100+${title_y} "$line" \
      $output
    title_y=$((title_y + 75))
  done
  
  # Add item count
  convert $output \
    -fill '#6b7280' \
    -font Arial -pointsize 32 \
    -gravity SouthWest \
    -annotate +100+140 "${item_count} Items" \
    $output
  
  # Add branding
  convert $output \
    -fill '#1f2937' \
    -font Arial-Bold -pointsize 28 \
    -gravity SouthEast \
    -annotate +100+140 "DevOps Daily" \
    -fill '#6b7280' \
    -font Arial -pointsize 20 \
    -gravity SouthEast \
    -annotate +100+105 "devops-daily.com" \
    $output
  
  echo "✓ Generated: ${slug}-og.png"
}

echo "Generating OG images for checklists..."
echo ""

# Generate individual checklist OG images
generate_og_image "ssh-hardening" "SSH Hardening|Checklist" "Security" "Intermediate" "12" "#1e40af" "#3b82f6" "#f59e0b"
generate_og_image "kubernetes-security" "Kubernetes Security|Checklist" "Cloud" "Advanced" "9" "#7c3aed" "#a78bfa" "#ef4444"
generate_og_image "aws-security" "AWS Security|Checklist" "Cloud" "Intermediate" "8" "#7c3aed" "#a78bfa" "#f59e0b"
generate_og_image "cicd-pipeline-setup" "CI/CD Pipeline|Setup Checklist" "DevOps" "Intermediate" "7" "#ea580c" "#fb923c" "#f59e0b"
generate_og_image "production-deployment" "Production|Deployment Checklist" "DevOps" "Beginner" "9" "#ea580c" "#fb923c" "#10b981"
generate_og_image "terraform-repo-structure" "Terraform Repository|Structure Checklist" "IaC" "Beginner" "12" "#059669" "#34d399" "#10b981"

# Generate listing page OG image
convert -size 1200x630 \
  gradient:"#1e40af"-"#ea580c" \
  -swirl 0 \
  public/images/checklists/checklists-og.png

convert public/images/checklists/checklists-og.png \
  -fill 'rgba(255,255,255,0.95)' \
  -draw 'rectangle 60,60 1140,570' \
  public/images/checklists/checklists-og.png

convert public/images/checklists/checklists-og.png \
  -fill '#1f2937' \
  -font Arial-Bold -pointsize 72 \
  -gravity NorthWest \
  -annotate +100+140 "DevOps & Security" \
  -annotate +100+230 "Checklists" \
  -fill '#6b7280' \
  -font Arial -pointsize 32 \
  -annotate +100+320 "Interactive checklists for best practices" \
  -fill '#1e40af' \
  -font Arial-Bold -pointsize 28 \
  -annotate +100+410 "6 Checklists Available" \
  -fill '#1f2937' \
  -font Arial-Bold -pointsize 28 \
  -gravity SouthEast \
  -annotate +100+140 "DevOps Daily" \
  -fill '#6b7280' \
  -font Arial -pointsize 20 \
  -annotate +100+105 "devops-daily.com" \
  public/images/checklists/checklists-og.png

echo "✓ Generated: checklists-og.png (listing page)"
echo ""
echo "All OG images generated successfully!"
echo "Output directory: public/images/checklists"

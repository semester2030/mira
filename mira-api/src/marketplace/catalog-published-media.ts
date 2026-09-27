/** The public catalog media rule. Pending removal stays visible until review approval deletes the row. */
export function publishedCatalogMediaWhere(ownerKind: string, ownerId: string) {
  return { active: true, publication: 'published', ownerKind, ownerId };
}

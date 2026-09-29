'use client';
import {logoutAction} from '@/app/login/actions';
import {FloatingLayer,MenuButton,MenuHeader,MenuLink,MenuScope,MenuSeparator,MenuSubmit,menuKeyDown,usePopover} from '@/components/primitives/Popover';
import {InstrumentIcon} from './InstrumentIcon';
import {ThemeMenuItems} from './ThemeToggle';
import {openHelp,openOrganizationSwitcher} from './events';
import {initials,roleShortLabel,splitActorLabel,type ShellIdentity} from './ShellIdentity';
import styles from './AccountMenu.module.css';

/**
 * Account menu (audit §E2). Rendered in a portal above the rail footer, so it
 * is never clipped by the rail and never pushes it. Sign out is a direct item
 * calling the existing logout action.
 */
export function AccountMenu({identity,collapsed=false}:{identity:ShellIdentity;collapsed?:boolean}){
 const popover=usePopover({placement:collapsed?'right-end':'top-start',kind:'menu'});
 const {access,presentation,guest}=identity;
 // The role annotation a Platform Owner carries in records stays out of the display name (m9).
 const {name,note}=splitActorLabel(access.actor.label);
 // A Demo guest is not a member with a role; the identity line says what it is (m12).
 const role=guest?'Demo access':roleShortLabel(access.role,access.platformRole);
 const canSwitch=!guest&&(identity.contexts?.length??0)>1;
 return <div className={styles.account} data-collapsed={collapsed||undefined}>
  <button type="button" className={styles.trigger} aria-label={`Account: ${name}`} data-tip={collapsed?name:undefined} data-tip-side="right" {...popover.triggerProps}>
   <span className={styles.avatar} aria-hidden="true">{initials(name)}</span>
   <span className={styles.who}><strong>{name}</strong><small>{role}{!guest&&access.isProductLead?' · Product Lead':''}</small></span>
   <InstrumentIcon name="chevrons" className={styles.chevron}/>
  </button>
  <FloatingLayer popover={popover} role="menu" label="Account" width={288} onKeyDown={menuKeyDown(popover.close)}>
   <MenuScope close={popover.close}>
    <MenuHeader>
     <div className={styles.identity}>
      <span className={styles.avatarLarge} aria-hidden="true">{initials(name)}</span>
      <span><strong>{name}</strong>{identity.email&&<small>{identity.email}</small>}{note&&<small>{note}</small>}</span>
     </div>
     <p className={styles.context}><span>{presentation.organizationName}</span><span className={styles.role}>{role}</span>{presentation.isDemo&&<span className={styles.demo}>Synthetic demo</span>}</p>
     {access.platformRole==='PLATFORM_OWNER'&&<p className={styles.platform}>Platform Owner · global authority</p>}
    </MenuHeader>
    <MenuSeparator/>
    {canSwitch&&<MenuButton icon={<InstrumentIcon name="switch"/>} onSelect={()=>requestAnimationFrame(openOrganizationSwitcher)}>Switch organization</MenuButton>}
    <MenuLink href="/account" icon={<InstrumentIcon name="user"/>}>My account</MenuLink>
    <MenuLink href="/account/connections" icon={<InstrumentIcon name="plug"/>}>Connected sources</MenuLink>
    <MenuSeparator/>
    <ThemeMenuItems/>
    <MenuSeparator/>
    <MenuButton icon={<InstrumentIcon name="keyboard"/>} trailing={<kbd className="pw-kbd">?</kbd>} onSelect={()=>openHelp('shortcuts')}>Keyboard shortcuts</MenuButton>
    <MenuButton icon={<InstrumentIcon name="help"/>} onSelect={()=>openHelp()}>Help</MenuButton>
    <MenuSeparator/>
    <form action={logoutAction}>
     <input type="hidden" name="scopeWorkspaceId" value={access.workspaceId}/>
     <MenuSubmit tone="danger" icon={<InstrumentIcon name="logout"/>} description={guest?'Your changes stay in the shared demo':undefined}>{guest?'Leave demo':'Sign out'}</MenuSubmit>
    </form>
   </MenuScope>
  </FloatingLayer>
 </div>;
}

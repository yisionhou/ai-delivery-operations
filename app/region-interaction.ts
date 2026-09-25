import type { ThreeEvent } from '@react-three/fiber';

// Synchronous ownership prevents a late exit from clearing a newer region's hover.
// Notify outside React state updaters; duplicate enter/exit events have no side effects.
export function createRegionHoverOwner<Key extends string>(notify:(key:Key|null)=>void) {
  let current:Key|null=null;
  return (key:Key,active:boolean)=>{
    const next=active?key:current===key?null:current;
    if(next===current)return;
    current=next;
    notify(next);
  };
}

export function createRegionPointerHandlers<Key extends string>(key:Key,
  gate:{current:{locked:boolean;moved:boolean}},
  hover:(key:Key,active:boolean)=>void,select:(key:Key)=>void) {
  return {
    onPointerOver(event:ThreeEvent<PointerEvent>){
      if(gate.current.locked)return;
      event.stopPropagation();
      hover(key,true);
    },
    onPointerOut(event:ThreeEvent<PointerEvent>){
      // R3F 9.8 reuses the stored enter event here. Never call its stopPropagation:
      // that synchronously invokes cancelPointer and re-enters other exit handlers.
      // Moving between child meshes within this same RegionGroup is not a region exit.
      if(event.intersections.some(hit=>hit.eventObject===event.eventObject))return;
      hover(key,false);
    },
    onClick(event:ThreeEvent<MouseEvent>){
      if(gate.current.locked||gate.current.moved||event.delta>=5)return;
      event.stopPropagation();
      select(key);
    },
  };
}

// Decorative geometry still renders normally; only its raycast participation is removed.
export const noDecorationRaycast=()=>{};

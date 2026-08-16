import * as Icons from "../icons";
import type { ComponentType } from "react";

type NavigationSection = {
  label: string;
  items: Array<{
    title: string;
    url?: string;
    icon: ComponentType<any>;
    items?: Array<{ title: string; url: string }>;
    adminOnly?: boolean;
  }>;
};

export const NAV_DATA: NavigationSection[] = [
  {
    label: "MENU PRINCIPAL",
    items: [
      {
        title: "Panel de control",
        url: "/dashboard",
        icon: Icons.HomeIcon,
        adminOnly: true,
      },
      {
        title: "Toma de pedidos",
        url: "/pos",
        icon: Icons.CiShop,
        items: [],
      },
      // Sección conservada para reactivarla cuando vuelva a necesitarse.
      // {
      //   title: "Menu",
      //   url: "/menu",
      //   icon: Icons.MdOutlineRestaurantMenu,
      //   items: [],
      // },
      {
        title: "Inventario",
        url: "/inventory",
        icon: Icons.MdOutlineInventory,
        items: [],
      },
      {
        title: "Compras y gastos",
        icon: Icons.PieChart,
        adminOnly: true,
        items: [
          { title: "Compras", url: "/inventory/purchases" },
          { title: "Gastos", url: "/expenses" },
        ],
      },
      {
        title: "Personal",
        url: "/personnel",
        icon: Icons.MdOutlinePeople,
        items: [],
        adminOnly: true,
      },
      {
        title: "Ventas",
        url: "/sales",
        icon: Icons.PieChart,
        items: [],
        adminOnly: true,
      },
      // Calendario conservado en el código, temporalmente oculto.
      // {
      //   title: "Calendar",
      //   url: "/calendar",
      //   icon: Icons.Calendar,
      //   items: [],
      // },
    ],
  },
];
